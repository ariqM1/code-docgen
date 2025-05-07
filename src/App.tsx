import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import DocumentationView from "./pages/DocumentationView";

function App() {
	return (
		<Router>
			<div className="app">
				<Routes>
					<Route path="/" element={<Dashboard />} />
					<Route
						path="/documentation"
						element={<DocumentationView />}
					/>
				</Routes>
			</div>
		</Router>
	);
}

export default App;
