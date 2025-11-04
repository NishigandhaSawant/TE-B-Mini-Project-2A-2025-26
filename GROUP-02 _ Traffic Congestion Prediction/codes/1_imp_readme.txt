the main front end file here is index11.html

(run dataset_gen to generate datasets as the dataset of 1 year is larger than github upload limit or just con=vert that 1 years dataset json to csv if needed)

first run nserver
then start http at any port preferable 8000

then open index11.html (at 8000 or 3000 in case other ports dont work)

----------------------------------------------------------------------------


KEYS NEEDED FOR FULL FUNCTIONALITIES

script.js
"
NOTIFICATION_TEMPLATE_ID
VERIFICATION_TEMPLATE_ID
emailjs.init("...")
mapApiKey (Found inside the notifyBtn event listener)
"



index11.html
"
YOUR_GOOGLE_MAPS_JAVASCRIPT_API_KEY_HERE
"

