async function testSale() {
  try {
    // 1. Login to get token
    const login = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@admin.com', password: 'password123' })
    }).then(res => res.json());

    if (!login.data?.token) {
        console.log("Login failed");
        return;
    }
    const token = login.data.token;
    console.log("Got token");

    // 2. Fetch a warehouse
    const whRes = await fetch('http://localhost:5000/api/v1/warehouses', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());
    
    const warehouseId = whRes.data?.[0]?.id;
    if (!warehouseId) {
        console.log("No warehouse");
        return;
    }

    // 3. Fetch a product
    const prodRes = await fetch('http://localhost:5000/api/v1/products', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());
    const product = prodRes.data?.[0];
    if (!product) {
        console.log("No product");
        return;
    }

    // 4. Fetch session
    const sessRes = await fetch('http://localhost:5000/api/v1/cash/active', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());
    const sessionId = sessRes.data?.id;

    // 5. Try creating Sale
    const saleBody = {
      warehouseId,
      cashSessionId: sessionId,
      subtotal: 100,
      discountAmount: 0,
      totalAmount: 100,
      items: [{
        productId: product.id,
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 100
      }],
      payments: [{
          amount: 100,
          details: 'CASH'
      }]
    };

    console.log("Sending sale payload...");

    const saleRes = await fetch('http://localhost:5000/api/v1/sales', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(saleBody)
    });
    
    const out = await saleRes.json();
    console.log("Status:", saleRes.status);
    console.log("Output:", out);

  } catch (error) {
    console.error(error.message);
  }
}

testSale();
