import {app} from './app.js';
import connectDB from './core/db/index.js';
import dotenv from 'dotenv';
dotenv.config({
    path: './.env' 
});

const PORT = process.env.PORT || 4000;

connectDB()
.then(() => {
    app.listen(PORT, () => {
        console.log('Server is running on port', PORT);
    });
})
.catch((error) => {
    console.error('Error connecting to the database:', error);
    process.exit(1);
});

