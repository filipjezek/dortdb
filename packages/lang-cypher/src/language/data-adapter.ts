export type EdgeDirection = 'in' | 'out' | 'any';

/**
 * Data adapter for the Cypher language.
 * @template GraphType - the type of the adapted graph data structure
 * @template NodeType - the type of the nodes in the graph
 * @template EdgeType - the type of the edges in the graph
 */
export interface CypherDataAdaper<
  GraphType = any,
  NodeType extends Record<string, unknown> = any,
  EdgeType extends Record<string, unknown> = any,
> {
  /**
   * Get nodes by their labels.
   * @param graph The graph to query.
   * @param labels The labels to filter by.
   */
  getNodesByLabels(graph: GraphType, ...labels: string[]): Iterable<NodeType>;
  /**
   * Filter nodes in the graph.
   * @param graph The graph to query.
   * @param predicate A function to test each node.
   */
  filterNodes(
    graph: GraphType,
    predicate?: (node: NodeType) => boolean,
  ): Iterable<NodeType>;
  /**
   * Get edges by their type.
   * @param graph The graph to query.
   * @param type The type to filter by.
   */
  getEdgesByType(graph: GraphType, type: string): Iterable<NodeType>;
  /**
   * Filter edges in the graph.
   * @param graph The graph to query.
   * @param predicate A function to test each edge.
   */
  filterEdges(
    graph: GraphType,
    predicate?: (src: NodeType, tgt: NodeType, edge: NodeType) => boolean,
  ): Iterable<NodeType>;
  /**
   * Get edges connected to a specific node by their type and direction.
   * @param graph The graph to query.
   * @param node The node to get edges for.
   * @param type The type to filter by.
   * @param direction The direction to filter by.
   */
  getNodeEdgesByType(
    graph: GraphType,
    node: NodeType,
    type: string,
    direction: EdgeDirection,
  ): Iterable<EdgeType>;
  /**
   * Filter edges connected to a specific node.
   * @param graph The graph to query.
   * @param node The node to get edges for.
   * @param direction The direction to filter by.
   * @param predicate A function to test each edge.
   */
  filterNodeEdges(
    graph: GraphType,
    node: NodeType,
    direction: EdgeDirection,
    predicate?: (src: NodeType, tgt: NodeType, edge: EdgeType) => boolean,
  ): Iterable<EdgeType>;
  /**
   * Get the node connected to a specific edge.
   * @param graph The graph to query.
   * @param edge The edge to get the node for.
   * @param type The type of the node to get (source or target).
   */
  getEdgeNode(
    graph: GraphType,
    edge: EdgeType,
    type: 'source' | 'target',
  ): NodeType;

  /**
   * Check if a node is connected to a specific edge.
   * @param graph The graph to query.
   * @param node The node to check.
   * @param edge The edge to check.
   * @param direction The direction to check.
   */
  isConnected(
    graph: GraphType,
    node: NodeType,
    edge: EdgeType,
    direction: EdgeDirection,
  ): boolean;
  /**
   * Check if a node has all of the specified labels.
   * @param graph The graph to query.
   * @param node The node to check.
   * @param labels The labels to check for.
   */
  hasLabels(graph: GraphType, node: NodeType, labels: string[]): boolean;
  /**
   * Return the labels of a node.
   * @param graph The graph to query.
   * @param node The node to check.
   */
  getLabels(graph: GraphType, node: NodeType): string[];
  /**
   * Check if an edge has any of the specified types.
   * @param graph The graph to query.
   * @param edge The edge to check.
   * @param types The types to check for.
   */
  hasAnyType(graph: GraphType, edge: EdgeType, types: string[]): boolean;
  /**
   * Return the type of an edge.
   * @param graph The graph to query.
   * @param edge The edge to check.
   */
  getType(graph: GraphType, edge: EdgeType): string;
}
