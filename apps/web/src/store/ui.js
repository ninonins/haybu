import { create } from "zustand";

export const useUiStore = create((set) => ({
  reportDeviceId: "",
  setReportDeviceId: (value) => set({ reportDeviceId: value })
}));
