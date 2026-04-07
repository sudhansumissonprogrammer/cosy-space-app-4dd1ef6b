import { createContext, useContext } from "react";

interface AdminViewContextType {
  isAdminView: boolean;
}

const AdminViewContext = createContext<AdminViewContextType>({ isAdminView: false });

export const AdminViewProvider = AdminViewContext.Provider;
export const useIsAdminView = () => useContext(AdminViewContext).isAdminView;
