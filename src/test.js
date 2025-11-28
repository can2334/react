const axios = require('axios');

(async () => {
    try {
        const response = await axios.post('http://localhost:5000/messages', {
            cookie: "token=user_fcd99df2ff945d051a26730e8f6b91540cae2af4ed913fc2fb6b268c1bcb83ae;",
            otherId: 2
        });
        console.log(response.data);
    } catch (error) {
        console.error(error);
    }
})()