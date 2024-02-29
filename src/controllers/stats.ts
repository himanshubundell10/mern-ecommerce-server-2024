import { myCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { calculatePercentage, getChartData, getInventories } from "../utils/features.js";



//dashboard stats
export const getDashboardStats = TryCatch(async (req, res, next) => {

    let stats = {};
    const key = "admin-stats"
    if (myCache.has(key))
        stats = JSON.parse(myCache.get(key) as string);

    else {
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const thisMonth = {
            start: new Date(today.getFullYear(), today.getMonth(), 1),
            end: today,
        }

        const lastMonth = {
            start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
            end: new Date(today.getFullYear(), today.getMonth(), 0),
        }
        //product that created at this month
        const thisMonthProductsPromise = Product.find({
            createdAt: {
                $gte: thisMonth.start,
                $lte: thisMonth.end,
            },
        })
        //product that created at last month
        const lastMonthProductsPromise = Product.find({
            createdAt: {
                $gte: lastMonth.start,
                $lte: lastMonth.end,
            },
        })


        //user create at this month
        const thisMonthUsersPromise = User.find({
            createdAt: {
                $gte: thisMonth.start,
                $lte: thisMonth.end,
            },
        })
        //user created at last month
        const lastMonthUsersPromise = User.find({
            createdAt: {
                $gte: lastMonth.start,
                $lte: lastMonth.end,
            },
        })

        //order created this month
        const thisMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: thisMonth.start,
                $lte: thisMonth.end,
            },
        })
        //order created at last month
        const lastMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: lastMonth.start,
                $lte: lastMonth.end,
            },
        });

        //order created at six month b/w
        const lastSixMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: sixMonthsAgo,
                $lte: today,
            },
        });
        //latest 4 transition 
        const latestTransactionsPromise = Order.find({})
            .select(["orderItems", "discount", "total", "status"])
            .limit(4)

        const [
            thisMonthProducts,
            thisMonthUsers,
            thisMonthOrders,
            lastMonthProducts,
            lastMonthUsers,
            lastMonthOrders,
            porductsCount,
            usersCount,
            allOrders,
            lastSixMonthOrders,
            categories,//all unique catagorie show here not count bus category name will be show
            femaleUsersCount,
            latestTransaction,
        ] = await Promise.all([
            thisMonthProductsPromise,
            thisMonthUsersPromise,
            thisMonthOrdersPromise,
            lastMonthProductsPromise,
            lastMonthUsersPromise,
            lastMonthOrdersPromise,
            Product.countDocuments(),
            User.countDocuments(),
            Order.find({}).select("total"),
            lastSixMonthOrdersPromise,
            Product.distinct("category"),
            User.countDocuments({ gender: "female" }),
            latestTransactionsPromise,
        ]);



        //reduce method for calculate this months revenue by order 
        const thisMonthRevenue = thisMonthOrders.reduce((total, order) => total + (order.total || 0), 0

        )
        //reduce method for calculate last months revenue by order 
        const lastMonthRevenue = lastMonthOrders.reduce((total, order) => total + (order.total || 0), 0

        )

        const changePercent = {
            //calculate revenue b/w last and curr month
            revenue: calculatePercentage(thisMonthRevenue, lastMonthRevenue),
            //calculate percent of product this and last month
            product: calculatePercentage(thisMonthProducts.length, lastMonthProducts.length),
            //calculate percent of user this and last month
            user: calculatePercentage(thisMonthUsers.length, lastMonthUsers.length),
            //calculate percent of orders this and last month
            order: calculatePercentage(thisMonthOrders.length, lastMonthOrders.length),

        };

        //all revenue
        const revenue = allOrders.reduce
            ((total, order) =>
                total + (order.total || 0),
                0
            );
        //all counts of revenue,user , product, order
        const count = {
            revenue,
            user: usersCount,
            product: porductsCount,
            order: allOrders.length,
        }

        //create a array to show month diff and flow charts
        const orderMonthCounts = new Array(6).fill(0);
        const orderMonthRevenue = new Array(6).fill(0);
        //month diff
        lastSixMonthOrders.forEach((order) => {
            const creationDate = order.createdAt;
            const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;

            if (monthDiff < 6) {
                orderMonthCounts[6 - monthDiff - 1] += 1;
                orderMonthRevenue[6 - monthDiff - 1] += order.total;
            }
        })

        //count uniqe category only 
        // 1st easy method
        // const categoriesCountPromise = categories.map((category) => Product.countDocuments({ category }));

        // const categoriesCount = await Promise.all(categoriesCountPromise);

        // const categoryCount: Record<string, number>[] = [];

        // //show unique category and count percent of those unique categories
        // categories.forEach((category, i) => {
        //     categoryCount.push({
        //         [category]: Math.round((categoriesCount[i] / porductsCount) * 100),
        //     });
        // });
        // 2nd method 
        const categoryCount: Record<string, number>[] = await getInventories({ categories, porductsCount });






        //male female userratio 
        const userRatio = {
            male: usersCount - femaleUsersCount,
            female: femaleUsersCount,
        }


        //modify latest 4 transition 
        const modifiedLatestTransaction = latestTransaction.map((i) => ({
            _id: i._id,
            discount: i.discount,
            amount: i.total,
            quantity: i.orderItems.length,
            status: i.status,
        }))

        stats = {
            categoryCount,
            changePercent,
            count,
            chart: {
                order: orderMonthCounts,
                revenue: orderMonthRevenue,
            },
            userRatio,
            latestTransaction: modifiedLatestTransaction,

        }

        myCache.set(key, JSON.stringify(stats))




    }

    return res.status(200).json({
        success: true,
        stats,
    });


});

//pie charts route
export const getPieCharts = TryCatch(async (req, res, next) => {

    let charts;
    const key = "admin-pie-charts"

    if (myCache.has(key)) charts = JSON.parse(myCache.get(key) as string);

    else {


        const allOrderPromise = Order.find({}).select([
            "total",
            "dicount",
            "subtotal",
            "tax",
            "shippingCharges"
        ])
        //showing order status charts
        const [
            processingOrder,
            shippedOrder,
            deliveredOrder,
            categories,
            porductsCount,
            outOfStock,
            allOrders,
            allUsers,
            adminUsers,
            customerUsers,

        ] = await
                Promise.all([
                    Order.countDocuments({ status: "Processing" }),
                    Order.countDocuments({ status: "Shipped" }),
                    Order.countDocuments({ status: "Delivered" }),
                    Product.distinct("category"),
                    Product.countDocuments(),
                    Product.countDocuments({ stock: 0 }),
                    allOrderPromise,
                    User.find({}).select(["dob"]),
                    User.countDocuments({ role: "admin" }),
                    User.countDocuments({ role: "user" }),

                ]);

        const orderFullfillment = {
            processing: processingOrder,
            shipped: shippedOrder,
            delivered: deliveredOrder,

        }
        //show porudct category and its percent 
        const productCategories: Record<string, number>[] = await getInventories({ categories, porductsCount });
        //check porduct stock avaliblity
        const stockAvailablity = {

            inStock: porductsCount - outOfStock,
            outOfStock,

        }
        //total income find 
        const grossIncome = allOrders.reduce((prev, order) => prev + (order.total || 0),
            0
        );
        //total discount
        const discount = allOrders.reduce((prev, order) => prev + (order.discount || 0),
            0
        );
        //total productionCost
        const productionCost = allOrders.reduce((prev, order) => prev + (order.shippingCharges || 0),
            0
        );

        //total burnt
        const burnt = allOrders.reduce((prev, order) => prev + (order.tax || 0),
            0
        );
        //total marketigcost
        const marketingCost = Math.round(grossIncome * (30 / 100));
        //net margin 
        const netMargin = grossIncome - discount - productionCost - burnt - marketingCost



        //revenuedistribution 
        const revenueDistribution = {
            netMargin,
            discount,
            productionCost,
            burnt,
            marketingCost,
        }

        const usersAgeGroup = {
            teen: allUsers.filter((i) => i.age < 20).length,
            adult: allUsers.filter((i) => i.age >= 20 && i.age < 40).length,
            old: allUsers.filter((i) => i.age >= 40).length,
        }






        //admin and customer count
        const adminCustomer = {
            admin: adminUsers,
            customer: customerUsers,
        }


        charts = {
            orderFullfillment,
            productCategories,
            stockAvailablity,
            revenueDistribution,
            usersAgeGroup,
            adminCustomer,
        }


        myCache.set(key, JSON.stringify(charts))

    }
    return res.status(200).json({
        success: true,
        charts,
    });

})

//bar charts
export const getBarCharts = TryCatch(async (req, res, next) => {
    let charts;
    const key = "admin-bar-charts";
    if (myCache.has(key)) charts = JSON.parse(myCache.get(key) as string);

    else {
        const today = new Date();

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        //prodct created at six month b/w
        const sixMonthProductPromise = Product.find({
            createdAt: {
                $gte: sixMonthsAgo,
                $lte: today,
            },
        }).select("createdAt");
        //prodct created at six month b/w
        const sixMonthUsersPromise = User.find({
            createdAt: {
                $gte: sixMonthsAgo,
                $lte: today,
            },
        }).select("createdAt");
        //prodct created at six month b/w
        const twelveMonthOrdersPromise = User.find({
            createdAt: {
                $gte: twelveMonthsAgo,
                $lte: today,
            },
        }).select("createdAt");


        const [products, users, orders] = await Promise.all([
            sixMonthProductPromise,
            sixMonthUsersPromise,
            twelveMonthOrdersPromise
        ]);
        // last 6 months product count
        const productCounts = getChartData({ length: 6, today, docArr: products });
        // last 6 months user count
        const usersCounts = getChartData({ length: 6, today, docArr: users });
        // last 6 months order count
        const ordersCounts = getChartData({ length: 12, today, docArr: orders });

        charts = {
            users: usersCounts,
            product: productCounts,
            orders: ordersCounts,
        }

        myCache.set(key, JSON.stringify(charts));

    }
    return res.status(200).json({
        success: true,
        charts,
    });


})


//linecharts route
export const getLineCharts = TryCatch(async (req, res, next) => {

    let charts;
    const key = "admin-line-charts";
    if (myCache.has(key)) charts = JSON.parse(myCache.get(key) as string);

    else {
        const today = new Date();

        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const baseQuery = {
            createdAt: {
                $gte: twelveMonthsAgo,
                $lte: today,
            },
        }


        const [products, users, orders] = await Promise.all([
            Product.find(baseQuery).select("createdAt"),
            User.find(baseQuery).select("createdAt"),
            Order.find(baseQuery).select(["createdAt","discount","total"]),
        ]);
        // last 12 months product count
        const productCounts = getChartData({ length: 12, today, docArr: products });
        // last 12 months user count
        const usersCounts = getChartData({ length: 12, today, docArr: users });
        // last 12 months order count
        const discount = getChartData({ length: 12, today, docArr: orders,property:"discount", });
        // last 12 months revenue count
        const revenue = getChartData({ length: 12, today, docArr: orders,property:"total", });

        charts = {
            users: usersCounts,
            products: productCounts,
            discount,
            revenue,
           
        }

        myCache.set(key, JSON.stringify(charts));

    }
    return res.status(200).json({
        success: true,
        charts,
    });
    




})

