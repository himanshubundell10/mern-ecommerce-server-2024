import { stripe } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Coupon } from "../models/coupon.js";
import ErrorHandler from "../utils/utility-class.js";




export const createPaymentIntent = TryCatch(async (req, res, next) => {
    const { amount,shippingInfo,user } = req.body;
    const {address,city,state,country,pincode} = shippingInfo
  
    if (!amount) return next(new ErrorHandler("Please enter amount", 400));
    if (!user || !shippingInfo) return next(new ErrorHandler("Please Provide Customer Name And Address",400))
  
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Number(amount) * 100,
      currency: "inr",
      description:"Software devlopment services",
      shipping:{
        name:user.name,
        address:{
            line1:address,
            city:city,
            country:country,
            postal_code:pincode,
            state:state,
        }
      }
    });
  
    return res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  });

// genrate new coupon
export const newCoupon = TryCatch(async(req,res,next)=>{
const {coupon,amount} = req.body;

if(!coupon || !amount) return next(new ErrorHandler("Please Enter Both Coupon And Amount",400))
await Coupon.create({code:coupon,amount});

return res.status(201).json({
    success:true,
    message:`Coupon ${coupon} Created Successfully`,
})

});

//apply discount
export const applyDiscount = TryCatch(async(req,res,next)=>{
    const {coupon} = req.query;
    
const discount = await Coupon.findOne({code:coupon})

if(!discount) return next(new ErrorHandler("Invalid Coupon Code",400))
    
    return res.status(200).json({
        success:true,
        discount:discount.amount,
    })
    
    });

//all coupons
export const allCoupons = TryCatch(async(req,res,next)=>{
    
const coupons = await Coupon.find({})
    
    return res.status(200).json({
        success:true,
        coupons,
    })
    
    });

    //delete coupons
export const deleteCoupon = TryCatch(async(req,res,next)=>{
    const{id} = req.params;
    
    const coupon =  await Coupon.findByIdAndDelete(id);
    if(!coupon) return next(new ErrorHandler("Invalid Coupon Id",400))
        
        return res.status(200).json({
            success:true,
            message:`Coupon ${coupon?.code} Deleted Successfully `
        })
        
        });