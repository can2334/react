import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AdminYetkiKontrolProps {
    children?: React.ReactNode;
}

const AdminYetkiKontrol: React.FC<AdminYetkiKontrolProps> = ({ children }) => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (!userStr) {
            setIsAdmin(false);
            return;
        }

        try {
            const user = JSON.parse(userStr);
            // is_admin hem boolean hem 1/0 olabilir
            setIsAdmin(Boolean(user.is_admin));
        } catch {
            setIsAdmin(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin === false) {
            navigate("/home", { replace: true });
        }
    }, [isAdmin, navigate]);

    // yetki kontrolü bitene kadar hiçbir şey render etme
    if (isAdmin === null) return null;

    return <>{children}</>;
};

export default AdminYetkiKontrol;
