
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

export const formatTime = (time) => {
  return time;
};

export const isEmpty = (value) => {
  return (
    value === undefined ||
    value === null ||
    value === ""
  );
};

export const capitalize = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};