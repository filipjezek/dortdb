import { UnsupportedError } from '@dortdb/core';
import { MultiDirectedGraph } from 'graphology';
import { Attributes } from 'graphology-types';

export type EdgeDirection = 'in' | 'out' | 'any';

export interface CypherDataAdaper<
  GraphType = any,
  NodeType = any,
  EdgeType = any,
> {
  getNodesByLabels(graph: GraphType, ...labels: string[]): Iterable<NodeType>;
  filterNodes(
    graph: GraphType,
    predicate?: (node: NodeType) => boolean,
  ): Iterable<NodeType>;
  getEdgesByType(graph: GraphType, type: string): Iterable<NodeType>;
  filterEdges(
    graph: GraphType,
    predicate?: (edge: NodeType) => boolean,
  ): Iterable<NodeType>;
  getNodeEdgesByType(
    graph: GraphType,
    node: NodeType,
    type: string,
    direction: EdgeDirection,
  ): Iterable<EdgeType>;
  filterNodeEdges(
    graph: GraphType,
    node: NodeType,
    direction: EdgeDirection,
    predicate?: (node: NodeType, edge: EdgeType) => boolean,
  ): Iterable<EdgeType>;
  getNodeProperty(graph: GraphType, node: NodeType, property: string): unknown;
  getNodeProperties(graph: GraphType, node: NodeType): Record<string, unknown>;
  getEdgeProperty(graph: GraphType, edge: EdgeType, property: string): unknown;
  getEdgeProperties(graph: GraphType, edge: EdgeType): Record<string, unknown>;

  isConnected(
    graph: GraphType,
    edge: EdgeType,
    node: NodeType,
    direction: EdgeDirection,
  ): boolean;
  hasLabel(graph: GraphType, node: NodeType, label: string): boolean;
  hasType(graph: GraphType, edge: EdgeType, type: string): boolean;
}

export class GraphologyDataAdapter
  implements
    CypherDataAdaper<
      MultiDirectedGraph<Attributes, Attributes, Attributes & { type: string }>
    >
{
  getNodesByLabels(
    graph: MultiDirectedGraph,
    ...labels: string[]
  ): Iterable<unknown> {
    throw new UnsupportedError(
      'GraphologyDataAdapter does not support node labels',
    );
  }
  *filterNodes(
    graph: MultiDirectedGraph,
    predicate?: (node: unknown) => boolean,
  ): Iterable<unknown> {
    if (!predicate) {
      return graph.nodes();
    } else {
      for (const node of graph.nodes()) {
        if (predicate(node)) {
          yield node;
        }
      }
    }
  }
  *getEdgesByType(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes,
      Attributes & { type: string }
    >,
    type: string,
  ): Iterable<unknown> {
    for (const edge of graph.edges()) {
      if (graph.getEdgeAttribute(edge, 'type') === type) {
        yield edge;
      }
    }
  }
  *filterEdges(
    graph: MultiDirectedGraph,
    predicate?: (edge: unknown) => boolean,
  ): Iterable<unknown> {
    if (!predicate) {
      return graph.edges();
    } else {
      for (const edge of graph.edges()) {
        if (predicate(edge)) {
          yield edge;
        }
      }
    }
  }
  *getNodeEdgesByType(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes,
      Attributes & { type: string }
    >,
    node: unknown,
    type: string,
    direction: EdgeDirection,
  ): Iterable<unknown> {
    for (const edge of graph[
      direction === 'in'
        ? 'inEdges'
        : direction === 'out'
          ? 'outEdges'
          : 'edges'
    ](node)) {
      if (graph.getEdgeAttribute(edge, 'type') === type) {
        yield edge;
      }
    }
  }
  *filterNodeEdges(
    graph: MultiDirectedGraph,
    node: unknown,
    direction: EdgeDirection,
    predicate?: (node: unknown, edge: unknown) => boolean,
  ): Iterable<unknown> {
    for (const edge of graph[
      direction === 'in'
        ? 'inEdges'
        : direction === 'out'
          ? 'outEdges'
          : 'edges'
    ](node)) {
      if (!predicate || predicate(node, edge)) {
        yield edge;
      }
    }
  }
  getNodeProperty(
    graph: MultiDirectedGraph,
    node: unknown,
    property: string,
  ): unknown {
    return graph.getNodeAttribute(node, property);
  }
  getEdgeProperty(
    graph: MultiDirectedGraph,
    edge: unknown,
    property: string,
  ): unknown {
    return graph.getEdgeAttribute(edge, property);
  }

  getNodeProperties(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes,
      Attributes & { type: string }
    >,
    node: any,
  ): Record<string, unknown> {
    return graph.getNodeAttributes(node);
  }
  getEdgeProperties(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes,
      Attributes & { type: string }
    >,
    edge: any,
  ): Record<string, unknown> {
    return graph.getEdgeAttributes(edge);
  }

  isConnected(
    graph: MultiDirectedGraph,
    edge: unknown,
    node: unknown,
    direction: EdgeDirection,
  ): boolean {
    return graph[
      direction === 'in'
        ? 'inNeighbors'
        : direction === 'out'
          ? 'outNeighbors'
          : 'neighbors'
    ](node).includes(edge as any);
  }
  hasLabel(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes,
      Attributes & { type: string }
    >,
    node: unknown,
    label: string,
  ): boolean {
    throw new UnsupportedError(
      'GraphologyDataAdapter does not support node labels',
    );
  }
  hasType(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes,
      Attributes & { type: string }
    >,
    edge: unknown,
    type: string,
  ): boolean {
    return graph.getEdgeAttribute(edge, 'type') === type;
  }
}
