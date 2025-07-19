import { APIerror } from "../utils/APIerror.js";
import { asyncHandler} from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { APIresponse } from "../utils/APIresponse.js";


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


export { registerUser, loginUser, logoutUser }