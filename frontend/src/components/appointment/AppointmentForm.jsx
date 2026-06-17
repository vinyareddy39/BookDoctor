import { useState } from "react";

export default function AppointmentForm({ onSubmit }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  return (
    <div style={styles.form}>
      <input
        type="date"
        onChange={(e) => setDate(e.target.value)}
      />

      <input
        type="time"
        onChange={(e) => setTime(e.target.value)}
      />

      <button
        onClick={() => onSubmit(date, time)}
      >
        Book
      </button>
    </div>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: 200,
  },
};