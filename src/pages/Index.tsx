
import { useEffect, useState } from "react";
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import "@solana/wallet-adapter-react-ui/styles.css";
import { getPreparedTransaction, getTokensInUsersWallet } from "@/lib/utils";
import { Buffer } from "buffer";

interface Item {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

const items: Item[] = [
  {
    id: 1,
    name: "Premium Widget",
    description: "High-quality premium widget with advanced features",
    price: 10,
    image: "https://placehold.co/300x200",
  },
  {
    id: 2,
    name: "Deluxe Gadget",
    description: "Revolutionary gadget for everyday use",
    price: 5,
    image: "https://placehold.co/300x200",
  },
];
const network = import.meta.env.VITE_ENV == "dev" ? "https://devnet.helius-rpc.com/?api-key=" : "https://mainnet.helius-rpc.com/?api-key="
const API_KEY = import.meta.env.VITE_HELIUS_API



const Index = () => {
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [tokens, setTokens] = useState(null);
  const [tokenSelected, setTokenSelected] = useState({
    name: null,
    price: null,
    mint: null,
  })

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  useEffect(() => {
    const fetchTokensList = async () => {
      if (!connected) return
      // Please connect your Helius RPC 
      const usertokens = await getTokensInUsersWallet(publicKey, network, API_KEY)
      setTokens(usertokens)
      if (usertokens.length <= 0) return;
      const price = (totalPrice * usertokens[0].balance) / usertokens[0].usdc_price;
      setTokenSelected({ name: usertokens[0].name, price, mint: usertokens[0].mint })
    }

    fetchTokensList();
  }, [connected, publicKey, totalPrice])

  const calculatePrice = (token) => {
    const tokenItem = JSON.parse(token)
    console.log(tokenItem)
    setTokenSelected({
      name: tokenItem.symbol,
      price: (totalPrice * tokenItem.balance) / tokenItem.usdc_price,
      mint: tokenItem.mint,
    })
  }

  const handlePayment = async () => {
    if (!publicKey) {
      toast({
        title: "Please connect your wallet",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const connection = new Connection(network + API_KEY);

      const transactionBase64 = await getPreparedTransaction(publicKey, tokenSelected.mint, totalPrice)

      const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));

      const signedTransaction = await signTransaction(transaction);

      const transactionBinary = signedTransaction.serialize();

      const signature = await connection.sendRawTransaction(transactionBinary, {
        maxRetries: 10,
        preflightCommitment: "finalized",
      });

      const confirmation = await connection.confirmTransaction(signature);

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}\nhttps://solscan.io/${signature}/`);
      } else {
        console.log(`Transaction successful: https://solscan.io/tx/${signature}/`);
      }


      toast({
        title: "Payment successful!",
        description: "Your items will be delivered shortly.",
      });
    } catch (error) {
      console.log(error)
      toast({
        title: "Payment failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-end">

        <WalletModalProvider>
          <WalletMultiButton className="!bg-black hover:!bg-gray-800 transition-colors" />
        </WalletModalProvider>
      </div>


      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-semibold text-gray-900 mb-2">Checkout (example)</h1>
          <p className="text-gray-600">Complete your purchase with Any Token of Your Choice</p>
        </motion.div>

        <div className="flex flex-col  gap-8 mb-12">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-row bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <div className="aspect-w-16 aspect-h-9">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-48 object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {item.name}
                </h3>
                <p className="text-gray-600 mb-4">{item.description}</p>
                <p className="text-lg font-medium text-gray-900">
                  {item.price} USDC
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl p-8 shadow-sm mb-8"
        >
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg text-gray-600">Total Amount</span>
            <span className="text-2xl font-semibold text-gray-900">
              {totalPrice} USDC
            </span>
          </div>

          <div className="flex flex-col items-start gap-4">
            <label className="" >Select Token to Pay With (these are tokens in users wallet)</label>
            <select onChange={(e) => calculatePrice(e.target.value)} className="w-full p-2 border rounded-sm">
              {tokens?.map((token, index: number) => (
                <option key={index} value={JSON.stringify(token)}><img src={token.image} alt="" />{token.name}</option>
              ))}
            </select>
            <button
              onClick={handlePayment}
              disabled={!connected || loading}
              className={`w-full py-4 px-8 rounded-lg text-white font-medium transition-all duration-300 ${
                connected
                  ? "bg-black hover:bg-gray-800"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                  "Complete Purchase" + " " + (tokenSelected.mint !== null ? `(~= ${tokenSelected.price.toFixed(3)}) ${tokenSelected.name}` : "")
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
