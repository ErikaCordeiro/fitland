import React from "react";
import MessageCenter from "../components/MessageCenter.jsx";
export default function StudentMessages({ branding, onUnreadChange }) { return <MessageCenter mode="student" branding={branding} onUnreadChange={onUnreadChange} />; }
