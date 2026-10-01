import React from "react";
import MessageCenter from "../components/MessageCenter.jsx";
export default function PersonalMessages({ onUnreadChange }) { return <MessageCenter mode="personal" onUnreadChange={onUnreadChange} />; }
