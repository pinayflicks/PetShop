const { Orders } = require("../models/orders");
const { Cart } = require("../models/cart");
const express = require("express");
const router = express.Router();
const paypal = require("@paypal/checkout-server-sdk");

function getPayPalClient() {
  // return new paypal.core.PayPalHttpClient(
  //   new paypal.core.SandboxEnvironment(
  //     process.env.PAYPAL_CLIENT_ID,
  //     process.env.PAYPAL_SECRET
  //   )
  // );


  const environment =
  process.env.PAYPAL_MODE === "live"
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID_LIVE,
        process.env.PAYPAL_SECRET_LIVE
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID_TEST,
        process.env.PAYPAL_SECRET_TEST
      );

return new paypal.core.PayPalHttpClient(environment);


}

// PayPal Order Routes
router.post("/create-order", async (req, res) => {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");


  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      amount: {
          currency_code: 'USD',
          value: req.query.totalAmount
      }
  }]
  });

  try {
    const client = getPayPalClient();
    const order = await client.execute(request);
    res.json({ id: order.result.id });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating PayPal order");
  }
});

router.post("/capture-order", async (req, res) => {
  const { paymentId} = req.body;


  const request = new paypal.orders.OrdersCaptureRequest(paymentId);
  request.requestBody({});

  try {
    const client = getPayPalClient();
    const capture = await client.execute(request);

    const cartList = await Cart.find({userId:req.body.info.userid});

    const cartData = [];
  
    for(let i=0; i<cartList.length; i++){
      cartData.push({
        productId:cartList[i].productId,
        productTitle:cartList[i].productTitle,
        catName:cartList[i].catName,
        quantity:cartList[i].quantity,
        price:cartList[i].price,
        image:cartList[i].image,
        subTotal:cartList[i].subTotal,
      })
    }
  

    
    const orderInfo = {
      paymentId:capture.result.id,
      name:req.body.info.name,
      phoneNumber:req.body.info.phoneNumber,
      address:req.body.info.address,
      pincode:req.body.info.pincode,
      amount:req.body.info.amount,
      email:req.body.info.email,
      userid:req.body.info.userid,
      products:cartData,
      status:'pending',
      date:req.body.info.date
    }

    console.log(orderInfo)
  
    // Save order details to the database
    // const orderData = {
    //   orderId: capture.result.id,
    //   status: capture.result.status,
    //   payer: capture.result.payer,
    //   purchase_units: capture.result.purchase_units,
    // };



    const order = new Orders(orderInfo);
    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error capturing PayPal order:", error);
    res.status(500).json({ error: "Order capture failed" });
  }
});

module.exports = router;
