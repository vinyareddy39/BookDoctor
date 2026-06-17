export default function Button({
  text,
  onClick,
  type = "button",
}) {
  return (
    <button onClick={onClick} type={type} style={styles.btn}>
      {text}
    </button>
  );
}

const styles = {
  btn: {
    padding: "8px 12px",
    background: "black",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
};
