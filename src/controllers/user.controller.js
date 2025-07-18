import { APIerror } from "../utils/APIerror.js";
import { asyncHandler} from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const registerUser = asyncHandler( async (req,res) => {
    //get user details from frontend
    //validation that everything is correct or not
    //check if user already exists: username,email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    //create user object- create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return res

    //get user details from frontend
    const {fullName, email, username, password } = req.body
    console.log("email: ",email);

    // check that all fields are filled or not
   if(
    [fullName,email,username,password].some((field) => field?.trim() ==="")
   ){
throw new APIerror(400, "All fields are required")
   }


//check the user already exits or not
const existedUser = User.findOne({
    $or: [{username}, {email}]
})

if(existedUser){
    throw new APIerror(409, "User with email or username already exists")
}

//check for image or avatar

 const avatarLocalPath = req.files?.avatar[0]?.path;
 const coverImageLocalPath = req.files?.coverImage[0]?.path;

 if(!avatarLocalPath){
    throw new APIerror(400, "Avatar file is required")
 }

 //upload on cloudinary
const avatar = await uploadOnCloudinary(avatarLocalPath)
const coverImage = await uploadOnCloudinary(coverImageLocalPath)

if(!avatar){
    throw new APIerror(400, "Avatar file is required")
}

    //create user object- create entry in db
const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
    email,
    password,
    username: username.toLowerCase()
})

//remove password and refresh token
const createdUser = await User.findById(user._id).select("-password -refreshToken")

//check for user creation
if(!createdUser) {
    throw new APIerror(500, "Something went wrong while registering the user")
}


return res.status(201).json(
    new APIResponse(200, createdUser, "User registered Successfully")
)
} )


export { registerUser }