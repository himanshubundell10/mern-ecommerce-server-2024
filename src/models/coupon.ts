import mongoose, { Mongoose } from "mongoose";

const schema = new mongoose.Schema({
    code:{
        type:String,
        required:[true,"Please Enter The Coupan Code"],
        unique:true,
    },
    amount:{
        type:Number,
        required:[true,"Please Enter The Discount Amount Code"],
    },


})

export const Coupon = mongoose.model("Coupon",schema)