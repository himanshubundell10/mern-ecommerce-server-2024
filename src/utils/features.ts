import mongoose, { Document } from "mongoose";
import { myCache } from "../app.js";
import { Product } from "../models/product.js";
import { OrderItemType, invalidateCacheProps } from "../types/types.js";

export const connectDB = (uri: string) => {

    mongoose.connect(uri, {
        dbName: "Ecommerce_24"
    }
    ).then(c => console.log(`Db connect to ${c.connection.host}`))
        .catch((e) => console.log(e))

}

export const invalidateCache =  ({ product, order, admin, userId, orderId, productId }: invalidateCacheProps) => {

    if (product) {
        const productKeys: string[] = [
            "latest-product",
            "categories",
            "all-product",

        ];

        if (typeof productId === "string") productKeys.push(`product-${productId}`);

        if (typeof productId === "object")
            productId.forEach((i) => productKeys.push(`product-${i}`));


        myCache.del(productKeys)
    }
    if (order) {
        const ordersKeys: string[] = ["all-orders", `my-orders-${userId}`, `order-${orderId}`];

        myCache.del(ordersKeys)


    }
    if (admin) {
myCache.del([ "admin-stats","admin-pie-charts","admin-bar-charts","admin-line-charts"]);
    }
};

export const reduceStock = async (orderItems: OrderItemType[]) => {

    for (let i = 0; i < orderItems.length; i++) {
        const order = orderItems[i];
        const product = await Product.findById(order.productId)
        if (!product) throw new Error("Product Not Found");
        product.stock -= order.quantity;
        await product.save()


    }

};

//calculate percenter of last and new month
export const calculatePercentage = (thisMonth: number, lastMonth: number) => {
    if (lastMonth === 0) return thisMonth * 100
    const percent = (thisMonth  / lastMonth) * 100;
    return Number(percent.toFixed(0))


}


export const getInventories = async ({
    categories, porductsCount }: { categories: string[]; porductsCount: number }) => {

    //count uniqe category only 
    const categoriesCountPromise = categories.map((category) => Product.countDocuments({ category }));

    const categoriesCount = await Promise.all(categoriesCountPromise);

    const categoryCount: Record<string, number>[] = [];

    //show unique category and count percent of those unique categories
    categories.forEach((category, i) => {
        categoryCount.push({
            [category]: Math.round((categoriesCount[i] / porductsCount) * 100),
        });
    });

    return categoryCount;
}

interface MyDocument extends Document{
    createdAt :Date;
    discount?:number;
    total?:number;
    

}

type FuncProps ={
    length:number;
    docArr:MyDocument[];
    today:Date;
    property?:"discount" | "total";
}

export const getChartData = ({length,docArr,today,property}:FuncProps)=>{
         //create a array to show month diff and flow charts
         const data:number[]= new Array(length).fill(0);
         //month diff
         docArr.forEach((i) => {
             const creationDate = i.createdAt;
             const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
 
             if (monthDiff < length) {
                if(property){
                    data[length - monthDiff - 1] += i[property]!;
                }
                else{
                    data[length - monthDiff - 1] += 1;
                }
                 
            
                 
                
             }
         })
         return data
}


