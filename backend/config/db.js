const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Set strictQuery to true or false to avoid deprecation warning
        mongoose.set('strictQuery', true); // or false, based on your needs

        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
