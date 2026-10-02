import { IC, type IconName } from "@/lib/icons";

// Ícone de traço do protótipo. As strings vêm de constantes do próprio código.
export default function Icon({ name, className = "", style }: { name: IconName; className?: string; style?: React.CSSProperties }) {
  return <svg className={"i " + className} viewBox="0 0 24 24" style={style} dangerouslySetInnerHTML={{ __html: IC[name] }} />;
}
