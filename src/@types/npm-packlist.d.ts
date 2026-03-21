declare module 'npm-packlist' {
	type Tree = {
		path: string;
		package: Record<string, unknown>;
		edgesOut: Map<string, unknown>;
		workspaces?: Map<string, string>;
		isProjectRoot?: boolean;
	};

	function packlist(tree: Tree): Promise<string[]>;

	export default packlist;
}
