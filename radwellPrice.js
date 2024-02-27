const db = require('./modules/Postgres/js/index');
const {PromisePool} = require('@supercharge/promise-pool');

async function main () {
    let res = await db.query(`
        WITH skus AS (
            SELECT
                sku
            FROM
                sursuite.components
        )
        SELECT
            inventory_sku,
            ARRAY_AGG(s.sku) as skus_to_update,
            JSON_BUILD_OBJECT(
                    'original_packaging_price',original_packaging_price,
                    'radwell_packaging_price',radwell_packaging_price,
                    'refurbished_price',refurbished_price,
                    'repair_price',repair_price
            ) as prices

        FROM
            surplusapi.approved_templates
        INNER JOIN
            skus s ON SPLIT_PART(s.sku,'-',1) = inventory_sku::text
        WHERE
            inventory_sku > 2 
        GROUP BY
            inventory_sku
    `).then(({rows}) => rows);

    const radwellPricesUpdates = []
    let condition_map = {
        1: 'original_packaging_price',
        2: 'radwell_packaging_price',
        3: 'refurbished_price',
        4: 'refurbished_price',
    };
    await new PromisePool()
        .for(res)
        .withConcurrency(100)
        .process((row) => {
            let {skus_to_update, prices} = row;
            skus_to_update.forEach(sku => {
                let condition = sku.split('-')[1];
                if(!condition){
                    return;
                }
                radwellPricesUpdates.push({
                    sku,
                    radwellPrice: prices[condition_map[condition]]
                })

            })
        });

    await new PromisePool()
        .for(radwellPricesUpdates)
        .withConcurrency(100)
        .process(async ({sku, radwellPrice}) => {
            await db.query(`
                UPDATE
                    sursuite.components
                SET
                    radwell_price = $1
                WHERE
                    sku = $2
            `, [radwellPrice, sku])
        });

}

main()
    .then(() => console.log('done'))
    .catch(console.error)

module.exports = main;