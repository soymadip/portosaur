export default function Indent({ level = 1 }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: `${level * 2}em`,
      }}
    />
  );
}
