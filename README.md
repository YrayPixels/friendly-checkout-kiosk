# InstantPay API - Solana Payment Integration Guide

This guide explains how to implement the InstantPay API for accepting Solana-based token payments in your application. The implementation allows users to pay with any token in their wallet and the merchant recieve in USDC, making the checkout process flexible and user-friendly.

## 🚀 Features

- Connect to Solana wallets using wallet-adapter
- Fetch tokens from a user's wallet
- Allow users to select which token to pay with
- Dynamic price conversion based on token values
- Process payments via the InstantPay API
- Support for both development and production environments

## 📋 Prerequisites

- React-based application
- Helius API key for Solana RPC access
- InstantPay API authentication token

## 🔧 Installation

1. Install the required dependencies:

```bash
npm install @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui framer-motion
```

2. Set up environment variables in your `.env` file:

```
VITE_ENV=dev                            # Set to "dev" for devnet or remove for mainnet
VITE_HELIUS_API=your_helius_api_key     # Your Helius API key
VITE_INSTANT_PAY_API=your_api_key       # Your InstantPay API authentication token
```

## 🏗️ Implementation

### 1. Set Up Wallet Connection

First, ensure your application is wrapped with the necessary Wallet Adapter providers:

```jsx
import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// In your root component:
<WalletProvider wallets={[/* your wallet adapters */]}>
  <WalletModalProvider>
    <YourApp />
  </WalletModalProvider>
</WalletProvider>
```

### 2. Implement the Checkout Component

The main checkout component handles:
- Displaying products/items
- Fetching user's tokens
- Processing payments

Below is a simplified implementation based on the provided code:

```jsx
import { useEffect, useState } from "react";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getTokensInUsersWallet, getPreparedTransaction } from "@/lib/utils";

const Checkout = ({ items }) => {
  const { publicKey, connected, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState(null);
  const [tokenSelected, setTokenSelected] = useState({
    name: null,
    price: null,
    mint: null,
  });

  // Configure network based on environment
  const network = import.meta.env.VITE_ENV == "dev" 
    ? "https://devnet.helius-rpc.com/?api-key=" 
    : "https://mainnet.helius-rpc.com/?api-key=";
  const API_KEY = import.meta.env.VITE_HELIUS_API;
  
  // Calculate total price of items
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  // Fetch user's tokens when wallet connects
  useEffect(() => {
    const fetchTokensList = async () => {
      if (!connected) return;
      
      const userTokens = await getTokensInUsersWallet(publicKey, network, API_KEY);
      setTokens(userTokens);
      
      // Set default selected token if available
      if (userTokens.length > 0) {
        const price = (totalPrice * userTokens[0].balance) / userTokens[0].usdc_price;
        setTokenSelected({ 
          name: userTokens[0].name, 
          price, 
          mint: userTokens[0].mint 
        });
      }
    };

    fetchTokensList();
  }, [connected, publicKey, totalPrice]);

  // Update selected token when user makes a selection
  const calculatePrice = (token) => {
    const tokenItem = JSON.parse(token);
    setTokenSelected({
      name: tokenItem.symbol,
      price: (totalPrice * tokenItem.balance) / tokenItem.usdc_price,
      mint: tokenItem.mint,
    });
  };

  // Process payment
  const handlePayment = async () => {
    if (!publicKey) {
      alert("Please connect your wallet");
      return;
    }

    setLoading(true);

    try {
      const connection = new Connection(network + API_KEY);

      // Get prepared transaction from InstantPay API
      const transactionBase64 = await getPreparedTransaction(
        publicKey, 
        tokenSelected.mint, 
        totalPrice
      );

      // Deserialize and sign the transaction
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(transactionBase64, 'base64')
      );
      const signedTransaction = await signTransaction(transaction);
      
      // Send the signed transaction
      const transactionBinary = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(transactionBinary, {
        maxRetries: 10,
        preflightCommitment: "finalized",
      });

      // Confirm transaction success
      const confirmation = await connection.confirmTransaction(signature);
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      alert("Payment successful!");
    } catch (error) {
      alert("Payment failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Wallet connect button */}
      <WalletModalProvider>
        <WalletMultiButton />
      </WalletModalProvider>
      
      {/* Display items */}
      <div>
        {items.map((item) => (
          <div key={item.id}>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <p>{item.price} USDC</p>
          </div>
        ))}
      </div>
      
      {/* Payment section */}
      <div>
        <div>
          <span>Total Amount</span>
          <span>{totalPrice} USDC</span>
        </div>

        {/* Token selection dropdown */}
        <div>
          <label>Select Token to Pay With</label>
          <select onChange={(e) => calculatePrice(e.target.value)}>
            {tokens?.map((token, index) => (
              <option key={index} value={JSON.stringify(token)}>
                {token.name}
              </option>
            ))}
          </select>
          
          {/* Payment button */}
          <button
            onClick={handlePayment}
            disabled={!connected || loading}
          >
            {loading ? "Processing..." : 
              `Complete Purchase ${tokenSelected.mint !== null ? 
                `(~= ${tokenSelected.price.toFixed(3)}) ${tokenSelected.name}` : ""}`
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
```

### 3. Implement Utility Functions

Create a utils file with the necessary functions:

```typescript
// utils.ts
import { PublicKey } from "@solana/web3.js"

// Configure API URL based on environment
const API_URL = import.meta.env.VITE_ENV == "dev" 
  ? "http://localhost:3001/api" 
  : "http://localhost:3001/api" // Update this for production

// Fetch tokens from user's wallet
export const getTokensInUsersWallet = async (publicKey: PublicKey, network: string, API_KEY: string) => {
  const tokens = await fetchTokenAccounts(publicKey, network, API_KEY);

  // Extract fungible tokens with their details
  const fungible = tokens.result.items
    .filter((item) => item.interface === "FungibleToken")
    .map((token) => {
      const tokenInfo = token?.token_info;
      const content = token?.content?.metadata;
      
      return {
        name: content?.name,
        image: token?.content?.links?.image,
        symbol: content?.symbol,
        balance: tokenInfo?.balance * Math.pow(10, -tokenInfo?.decimals),
        decimals: tokenInfo?.decimals,
        usdc_price: tokenInfo?.price_info?.total_price,
        mint: token?.id,
      };
    });

  return fungible;
}

// Fetch token accounts from Helius API
export const fetchTokenAccounts = async (publickey: PublicKey, network: string, API_KEY: string) => {
  const response = await fetch(`${(network + API_KEY.trim())}`, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "jsonrpc": "2.0",
      "id": "text",
      "method": "getAssetsByOwner",
      "params": {
        "ownerAddress": publickey.toBase58(),
        "displayOptions": {
          showFungible: true // Return both fungible and non-fungible tokens
        }
      }
    }),
  });
  
  const data = await response.json();
  return data;
}

// Get prepared transaction from InstantPay API
export const getPreparedTransaction = async (publicKey: PublicKey, tokenMint: string, amount: number) => {
  const headersList = {
    "Accept": "*/*",
    "Authorization": "Bearer " + import.meta.env.VITE_INSTANT_PAY_API,
    "Content-Type": "application/json"
  }

  const bodyContent = JSON.stringify({
    "publicKey": publicKey.toString(),
    "tokenMint": tokenMint,
    "amount": amount
  });

  const response = await fetch(API_URL + "/prepare-transaction", {
    method: "POST",
    body: bodyContent,
    headers: headersList
  });

  const data = await response.json();
  return data.transaction;
}
```

## 🔄 Flow Explanation

1. **Initial Setup**: The user loads the checkout page with products/items.

2. **Wallet Connection**: The user connects their Solana wallet using the WalletMultiButton.

3. **Token Fetching**: Once connected, the application fetches all tokens in the user's wallet using Helius API.

4. **Token Selection**: The user can select which token they want to use for payment.

5. **Price Conversion**: The application dynamically calculates how much of the selected token is needed based on its current price relative to USDC.

6. **Payment Processing**:
   - The application requests a prepared transaction from the InstantPay API
   - The transaction is signed by the user's wallet
   - The signed transaction is sent to the Solana network
   - The application confirms the transaction was successful

## ⚙️ API Reference

### InstantPay API

The InstantPay API endpoint is used to prepare transactions:

```
POST /api/prepare-transaction
```

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "publicKey": "string", // User's wallet public key
  "tokenMint": "string", // Selected token mint address
  "amount": number       // Amount in USDC equivalent
}
```

**Response:**
```json
{
  "transaction": "string" // Base64 encoded transaction
}
```

### Helius API

Helius API is used to fetch token information:

```
POST https://{network}.helius-rpc.com/?api-key=YOUR_API_KEY
```

**Request Body:**
```json
{
  "jsonrpc": "2.0",
  "id": "text",
  "method": "getAssetsByOwner",
  "params": {
    "ownerAddress": "string", // User's wallet address
    "displayOptions": {
      "showFungible": true    // Include fungible tokens
    }
  }
}
```

## 🛠️ Customization

### Styling

The example uses Tailwind CSS for styling. You can customize the appearance by modifying the CSS classes.

### Environment Configuration

Update the `.env` file to switch between development and production environments:

- Set `VITE_ENV=dev` for devnet testing
- Remove `VITE_ENV` or set to anything other than "dev" for mainnet

### Error Handling

Enhance the error handling to provide more user-friendly messages and improve the payment experience.

## 📝 Notes

- Make sure to securely store your API keys and never expose them in client-side code
- Always test thoroughly on devnet before deploying to production
- Consider implementing webhook notifications for payment success/failure

## 🤝 Support