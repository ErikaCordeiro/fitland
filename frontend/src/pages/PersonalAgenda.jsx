import React from "react";
import AgendaModule from "./AgendaModule.jsx";

export default function PersonalAgenda({ students = [] }) {
  return <AgendaModule role="personal" students={students} />;
}
