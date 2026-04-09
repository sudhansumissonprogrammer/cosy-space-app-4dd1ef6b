import { useCart } from "@/contexts/CartContext";

export default function V17CartBadge() {
  const { cartCount, openCart, cartBounce } = useCart();
  return (
    <button
      onClick={openCart}
      className="relative flex h-10 w-10 items-center justify-center rounded-md transition-opacity hover:opacity-70 active:scale-[0.93]"
      aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
    >
      <svg width="24" height="24" fill="none" className={cartBounce ? "animate-bounce" : ""}>
        <path fill="currentColor" d="m16.102 4.278-1.2-1.649H6.098L4.898 4.278h11.204Zm2.23.307v.019h.018c.038.077.069.153.094.23a.56.56 0 0 1 .056.25v11.462c0 .333-.069.652-.206.959-.125.294-.294.55-.506.767-.212.23-.468.409-.768.536a2.233 2.233 0 0 1-.918.192H4.898c-.324 0-.637-.07-.937-.21a2.402 2.402 0 0 1-.749-.518 2.312 2.312 0 0 1-.525-.767 2.518 2.518 0 0 1-.187-.959V5.083a1.112 1.112 0 0 1 .075-.345l.038-.077a.3.3 0 0 0 .056-.076l2.398-3.26a.706.706 0 0 1 .28-.23A.71.71 0 0 1 5.705 1h9.592a.71.71 0 0 1 .356.096.706.706 0 0 1 .281.23l2.398 3.259ZM4.111 5.907v10.64c0 .102.018.204.056.306a.747.747 0 0 0 .43.44c.1.04.2.058.3.058h11.204a.74.74 0 0 0 .3-.057.748.748 0 0 0 .43-.44.887.887 0 0 0 .057-.308V5.907H4.11Zm8.786 2.454a.79.79 0 0 1 .225-.575.784.784 0 0 1 .58-.25c.213 0 .394.084.544.25a.758.758 0 0 1 .244.575c0 .562-.106 1.093-.319 1.591-.2.498-.48.933-.843 1.304-.362.37-.787.664-1.274.881a3.977 3.977 0 0 1-1.555.307c-.55 0-1.068-.102-1.555-.307A4.096 4.096 0 0 1 6.81 9.952c-.2-.498-.3-1.029-.3-1.591a.79.79 0 0 1 .225-.575.764.764 0 0 1 .562-.25c.225 0 .413.084.562.25a.758.758 0 0 1 .244.575c0 .345.062.665.187.958.125.294.3.55.525.767a2.259 2.259 0 0 0 1.686.729 2.258 2.258 0 0 0 1.686-.728c.225-.218.4-.474.525-.768.125-.293.187-.613.187-.958Z" />
      </svg>
      {cartCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
          style={{
            backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))",
            color: "var(--storefront-btn-text, hsl(var(--background)))",
          }}
        >
          {cartCount > 9 ? "9+" : cartCount}
        </span>
      )}
    </button>
  );
}
