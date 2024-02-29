import  express  from "express";
import { adminOnly } from "../middlewares/auth.js";
import { deleteProduct, getAdminProducts, getAllCategories, getAllProducts, getSingleProduct, getlatestProducts, newProduct, updateProduct } from "../controllers/product.js";
import { singleUpload } from "../middlewares/multer.js";


const app = express.Router()

// to cerate new product -/api/v1/product/new
app.post("/new",adminOnly,singleUpload,newProduct)

// to fet all products with filter /api/v1/product/all
app.get("/all",getAllProducts)

// to get 10 products - /api/v1/product/latest
app.get("/latest",getlatestProducts)


// to get all unique categories  - /api/v1/product/categories
app.get("/categories",getAllCategories)


//to get all prouct - api/v1/product/categories
app.get("/admin-products",adminOnly,getAdminProducts)



// to get update delte product
app.route("/:id").get(getSingleProduct).put(adminOnly,singleUpload,updateProduct).delete(adminOnly,deleteProduct)







export default app;