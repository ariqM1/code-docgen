import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import DocumentationView from "./pages/DocumentationView";

function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Dashboard />} />
				<Route
					path="/documentation/:repoId"
					element={<DocumentationView />}
				/>
			</Routes>
		</Router>
	);
}

export default App;
