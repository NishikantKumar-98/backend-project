import { APIerror } from "../utils/APIerror.js";
import { asyncHandler} from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { APIresponse } from "../utils/APIresponse.js";
import jwt from "jsonwebtoken"
import { validateHeaderName } from "http";


const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
       

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
          
        return {accessToken, refreshToken}

    } catch (error) {
        throw new APIerror(500,"something went wrong while generating refresh and access token")
    }
}

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
    const {fullname, email, username, password } = req.body;
    console.log("email: ",email);

    // check that all fields are filled or not
   if(
    [fullname,email,username,password].some((field) => field?.trim() ==="")
   ){
throw new APIerror(400, "All fields are required")
   }


//check the user already exits or not
const existedUser = await User.findOne({
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

if(!avatar ){
    throw new APIerror(400, "Avatar file is required")
}

    //create user object- create entry in db
const user = await User.create({
    fullname,
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
    new APIresponse(200, createdUser, "User registered Successfully")
)
} )

const loginUser = asyncHandler(async (req,res) => {
//req body => data
//check username or email
//find the user
//password check
//access and refresh token
//send cookies


//req body => data
const {email, username,password} = req.body


//check username or email
if(!username && !email) {
    throw new APIerror(400, "username or email is required")
}

//find the user
const user = await User.findOne({
    $or: [{username}, {email}]
})

if(!user) {
    throw new APIerror(404, "user does not exist")
}

//check password
const isPasswordValid = await user.isPasswordCorrect(password)

if(!isPasswordValid){
    throw new APIerror(401,"Invalid user or password")
}


const {accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

const options ={
    httpOnly: true,
    secure:true
}

return res.status(200)
.cookie("accessToken", accessToken,options)
.cookie("refreshToken", refreshToken, options)
.json(
    new APIresponse(
        200,
        {
        user: loggedInUser, accessToken,refreshToken
        },
        "user logged in successfully"
    )
)


})


const logoutUser = asyncHandler(async(req,res) => {
await User.findByIdAndUpdate(
    req.user._id,
    {
        $set:{
            refreshToken: undefined
        }
    },
    {
        new: true
    }
)

const options = {
    httpOnly:true,
    secure:true
}

return res
.status(200)
.clearCookie("accessToken",options)
.clearCookie("refreshToken",options)
.json(new APIresponse(200,{},"user logged out"))


})


const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if (!incomingRefreshToken){
        throw new APIerror(401, "unauthorized request")
    }

   try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
 
    const user = await User.findById(decodedToken?._id)
 
    if(!user) {
     throw new APIerror(401, "Invalid Refresh Token")
    }
 
    if (incomingRefreshToken !== user?.refreshToken) {
     throw new APIerror(401,"Refresh Token is expired or used")
     
    }
 
    const options = {
     httpOnly: true,
     secure:true
    }
 
 
    const {accesssToken,newrefreshToken} = await generateAccessAndRefreshToken(user._id)
 
    return res
    .status(200)
    .cookie("accessToken",accesssToken,options)
    .cookie("refreshToken",newrefreshToken ,options)
    .json(
     new APIresponse(
         200,
         {accesssToken,refreshToken: newrefreshToken},
         "Access Token refreshed"
     )
    )
   } catch (error) {
       throw new APIerror(401,error?.message || "invalid refresh token")
   }
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
const {oldPassword,newPassword} = req.body

const user = await User.findById(req.user?._id)
const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

if(!isPasswordCorrect){
    throw new APIerror(401,"Invalid old password")
}

user.password = newPassword
await user.save({validateBeforeSave:false})

return res
.status(200)
.json(new APIresponse(200,{},"Password changed successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new APIerror(401,"All field are required")
    }

const user = User.findByIdAndUpdate(
    req.user?._id,
    {
        $set: {
            fullname,
            email,
        }
    },
    {new: true}
).select("-password ")

return res
.status(200)
.json(new APIresponse(200,user,"account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
const avatarLocalPath = req.file?.path
if(!avatarLocalPath){
    throw new APIerror(400,"Avatar file is missing")
}

const avatar = await uploadOnCloudinary(avatarLocalPath)
if(!avatar.url){
    throw new APIerror(400,"error while uploading on avatar")
}

const user = await User.findByIdAndUpdate(
    req.user?._id
    {
        $set:{
            avatar:avatar.url
        }
    },
    {new:true}
).select("-password")

return res
.status(200)
.json(
    new APIresponse(200,user,"avatar image updated successfully")
)

})


const updateUserCoverImage = asyncHandler(async(req,res)=>{
const CoverImageLocalPath = req.file?.path
if(!CoverImageLocalPath){
    throw new APIerror(400,"CoverImage file is missing")
}

const CoverImage = await uploadOnCloudinary(CoverImageLocalPath)
if(!CoverImage.url){
    throw new APIerror(400,"error while uploading on CoverImage")
}

const user = await User.findByIdAndUpdate(
    req.user?._id
    {
        $set:{
            CoverImage:CoverImage.url
        }
    },
    {new:true}
).select("-password")

return res
.status(200)
.json(
    new APIresponse(200,user,"cover image updated successfully")
)

})


export { registerUser, 
         loginUser, 
         logoutUser, 
         refreshAccessToken,
         changeCurrentPassword,
         getCurrentUser,
         updateAccountDetails,
         updateUserAvatar,
         updateUserCoverImage
       }