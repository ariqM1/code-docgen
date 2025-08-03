import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";

function App() {
	return (
		<Router>
			<div className="app">
				<Routes>
					<Route path="/" element={<Dashboard />} />
					<Route path="/documentation" />
				</Routes>
			</div>
		</Router>
	);
}

export default App;
