import Product from "../models/product.model.js" 
import { redis } from "../lib/redi.js";
import cloudinary from '../lib/cloudinary.js'

export const getAllProducts = async (req , res) => {
    try {
        const products = await Product.find({}); // find all products
        res.json({ products })
    } catch (error) {
        console.log("Error in getting all products controller.", error.message)
        res.status(500).json({message: "Internal Server Error" , error: error.message});
    }
}

export const getFeaturedProducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get("featured_products");
        if(featuredProducts){
            return res.json(JSON.parse(featuredProducts))
        }
        //if not in redis fetch it from mongodb database
        //lean() is gonna return a javascript object instead of a mongodb document
        //  which is good for performance
        featuredProducts = await Product.find({isFeature: true}).lean();

        if(!featuredProducts){
            return res.status(404).json({message : 'No featured Products found'}) 
        }

        // store it in redis for future uses
        await redis.set("featured_products" , JSON.stringify(featuredProducts));

        res.json(featuredProducts);
    } catch (error) {
        console.log("Error in getting get featured products controller.", error.message)
        res.status(500).json({message: "Internal Server Error" , error: error.message});
    }
}

export const createProduct = async (req, res) => {
    try {
        const {name, description , price , image , category } = req.body;

        let cloudinaryResponse = null;

        if(image) {
            cloudinaryResponse = await clouinary.uploader.upload(image, {folder : "products"}) 
        }

        const product = await Product.create({
            name ,
            description,
            price,
            image : cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
            category 
        })

        res.status(201).json(product)
    } catch (error) {
        console.log("Error in create products controller.", error.message)
        res.status(500).json({message: "Internal Server Error" , error: error.message});
    }
}

export const deleteProduct = async (req , res) => {
    try {
        const product = await Product.findById(req.params.id);

        if(!product) {
            return res.status(404).json({ messsage : 'Product not found!'})
        }

        if(product.image){
            const publicId = product.image.split("/").pop().split(".")[0];//this ll get the image id from cloudinary
            try {
                await cloudinary.uploader.destroy(`products/${publicId}`)
                console.log("Delete from cloudinary"); 
            } catch (error) {
                console.log("Error deleting image from cloudinary", error)
            }
        }
        await Product.findByIdAndDelete(req.params.id)

        res.json({message: "Product deleted successfully"})
    } catch (error) {
        console.log("Error in deleteProduct Controller" , error.message);
        res.status(500).json({message: "Server Error" , error: error.message})
    }
}

export const getRecommendedProducts = async (req , res) => {
    try {
        const products = await Product.aggregate([
            {
                $sample: {size:3}
            },
            {
                $project: {
                    _id:1,
                    name:1,
                    description:1,
                    image:1,
                    price:1
                }
            }
        ])
        res.json(products)
    } catch (error) {
        console.log("Error in getRecommendedProducts Controller" , error.message);
        res.status(500).json({message: "Server Error" , error: error.message})
    }
}

export const getProductsByCategory = async (req , res) => {
    const {category} = req.params;
    try {
        
        const products = await Product.find({category});
        res.json(products);

    } catch (error) {
        console.log("Error in getProductsByCategory Controller" , error.message);
        res.status(500).json({message: "Server Error" , error: error.message})
    }
}

export const toggleFeaturedProduct = async (req , res) => {
    try {
        const product = await Product.findById(req.params.id);
        if(product) {
            product.isFeatured = !product.isFeatured;
            const updatedProduct = await product.save();
            await updateFeaturedProductsCache();
            res.json(updatedProduct);
        }
        else {
            res.status(404).json({message: 'Product not found!'})
        }
    } catch (error) {
        console.log("Error in toggleFeaturedProduct Controller" , error.message);
        res.status(500).json({message: "Server Error" , error: error.message})
    }
}

async function updateFeaturedProductsCache() {
    try {
        // lean is to return plain javaScript object
        //instead of full mongoose documents
        //this can significantly improve performance
        const featuredProducts = await Product.find({isFeatured: true}).lean();
        await redis.set("featured_products" , JSON.stringify(featuredProducts));

    } catch (error) {
        console.log("Error in update cache function" , error.message); 
    }
}