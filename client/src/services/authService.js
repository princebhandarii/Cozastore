import api from "./api";

// After Firebase auth succeeds, the backend is asked to load (or lazily
// create) the matching MongoDB user profile for this firebaseUid.
// The backend is the only source of truth for role - never trust
// anything the client computes locally.
export const fetchMyProfile = async () => {
  const { data } = await api.get("/users/me");
  return data.data;
};

export const updateMyProfile = async (payload) => {
  const { data } = await api.patch("/users/me", payload);
  return data.data;
};

export const listMyAddresses = async () => {
  const { data } = await api.get("/users/addresses");
  return data.data;
};

export const addMyAddress = async (address) => {
  const { data } = await api.post("/users/addresses", address);
  return data.data;
};

export const updateMyAddress = async (id, address) => {
  const { data } = await api.patch(`/users/addresses/${id}`, address);
  return data.data;
};

export const deleteMyAddress = async (id) => {
  const { data } = await api.delete(`/users/addresses/${id}`);
  return data.data;
};
