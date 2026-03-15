import { C } from "../colors";

/**
 * Clean, white glass card for high-end product display.
 */
export const ProductCard = ({ 
  children, 
  style = {} 
}: { 
  children: React.ReactNode; 
  style?: React.CSSProperties 
}) => (
  <div
    style={{
      backgroundColor: "#FFFFFF",
      border: `1px solid ${C.border}`,
      borderRadius: 32,
      padding: 40,
      boxShadow: `0 30px 60px ${C.shadow}`,
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    {children}
  </div>
);
