import { Toaster } from "sonner";
import { CartProvider } from "@/components/cart/cart-context";

/**
 * Layout area publik — menyediakan state keranjang (CartProvider, yang juga
 * merender sheet checkout) & toast (Sonner) untuk seluruh alur peminjaman.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </CartProvider>
  );
}
