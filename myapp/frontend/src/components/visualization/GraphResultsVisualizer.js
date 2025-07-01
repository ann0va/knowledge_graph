// src/components/visualization/GraphResultsVisualizer.js - Results Visualizer
import React, { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Eye,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Download,
    Maximize2,
    Minimize2
} from 'lucide-react';

// Custom Node Component
const EntityNode = ({ data, selected }) => {
    const { entity, database, entityType } = data;

    const getNodeColor = () => {
        if (database === 'both') return 'linear-gradient(45deg, #3B82F6, #EF4444)';
        return database === 'memgraph' ? '#3B82F6' : '#EF4444';
    };

    const getEntityIcon = () => {
        const icons = {
            person: '👤',
            place: '📍',
            work: '📚',
            award: '🏆',
            field: '🔬',
            occupation: '💼',
            workplace: '🏢'
        };
        return icons[entityType] || '⚪';
    };

    return (
        <div className={`px-3 py-2 shadow-lg rounded-lg border-2 ${
            selected ? 'border-yellow-400' : 'border-gray-300'
        } bg-white min-w-[120px] max-w-[200px]`}>
            <div
                className="w-full h-1 rounded-t mb-2"
                style={{
                    background: getNodeColor()
                }}
            ></div>

            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getEntityIcon()}</span>
                <span className="font-medium text-sm text-gray-800 truncate">
                    {entity.name || 'Unknown'}
                </span>
            </div>

            <div className="text-xs text-gray-500 truncate">
                ID: {entity.id || 'N/A'}
            </div>

            <div className="flex items-center gap-1 mt-1">
                {database === 'both' ? (
                    <>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </>
                ) : (
                    <div className={`w-2 h-2 rounded-full ${
                        database === 'memgraph' ? 'bg-blue-500' : 'bg-red-500'
                    }`}></div>
                )}
                <span className="text-xs text-gray-400 ml-1">
                    {entityType}
                </span>
            </div>
        </div>
    );
};

const nodeTypes = {
    entityNode: EntityNode,
};

const GraphResultsVisualizer = ({
                                    results,
                                    title = "Query Results",
                                    className = "",
                                    showControls = true,
                                    height = "400px"
                                }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Convert results to graph data
    const processResults = useCallback((results) => {
        console.log('🔍 GraphResultsVisualizer received results:', results);

        if (!results) {
            console.log('❌ No results provided');
            return { nodes: [], edges: [] };
        }

        let entities = [];

        // Handle different result formats
        if (Array.isArray(results)) {
            console.log('📋 Results is array:', results.length);
            entities = results;
        } else if (results.data) {
            console.log('📦 Results has data property');
            if (Array.isArray(results.data)) {
                entities = results.data;
            } else if (results.data.entities) {
                entities = results.data.entities;
            } else if (results.data.results) {
                entities = results.data.results;
            } else if (results.data.oracle || results.data.memgraph) {
                // Handle both database results
                const oracleEntities = results.data.oracle?.relationships || results.data.oracle || [];
                const memgraphEntities = results.data.memgraph?.relationships || results.data.memgraph || [];
                entities = [...(Array.isArray(oracleEntities) ? oracleEntities : []),
                    ...(Array.isArray(memgraphEntities) ? memgraphEntities : [])];
            }
        } else if (results.oracle || results.memgraph) {
            // Direct database results
            const oracleEntities = results.oracle?.relationships || results.oracle || [];
            const memgraphEntities = results.memgraph?.relationships || results.memgraph || [];
            entities = [...(Array.isArray(oracleEntities) ? oracleEntities : []),
                ...(Array.isArray(memgraphEntities) ? memgraphEntities : [])];
        } else if (results.relationships) {
            // Direct relationships
            entities = results.relationships.outgoing || results.relationships.incoming || [];
        }

        console.log('🔍 Extracted entities:', entities.length, entities);

        if (!Array.isArray(entities) || entities.length === 0) {
            console.log('❌ No entities found or not array');
            return { nodes: [], edges: [] };
        }

        // Convert entities to nodes
        const newNodes = entities.slice(0, 20).map((entity, index) => {
            // Handle different entity formats
            let id, name, database = 'unknown', entityType = 'unknown';

            if (entity.id || entity['e.id']) {
                // Standard entity format
                id = entity.id || entity['e.id'];
                name = entity.name || entity['e.name'] || `Entity ${index + 1}`;
                database = entity.database || (entity['e.id'] ? 'memgraph' : 'oracle');
                entityType = entity.entityType || entity.entity_type || 'person';
            } else if (entity.vertex_id) {
                // Oracle format
                id = entity.vertex_id;
                name = entity.NAME || entity.name || `Entity ${index + 1}`;
                database = 'oracle';
                entityType = 'person'; // Default
            } else {
                // Fallback
                id = `entity-${index}`;
                name = entity.name || entity.title || `Entity ${index + 1}`;
            }

            // Calculate position in circle layout
            const angle = (index / Math.min(entities.length, 20)) * 2 * Math.PI;
            const radius = Math.max(100, Math.min(entities.length, 20) * 20);

            return {
                id: `node-${id}`,
                type: 'entityNode',
                position: {
                    x: Math.cos(angle) * radius + 250,
                    y: Math.sin(angle) * radius + 200,
                },
                data: {
                    entity: { id, name },
                    database,
                    entityType,
                },
            };
        });

        // Create some sample edges (connections between nearby nodes)
        const newEdges = [];
        for (let i = 0; i < newNodes.length - 1; i++) {
            if (Math.random() > 0.7) { // 30% chance of connection
                newEdges.push({
                    id: `edge-${i}`,
                    source: newNodes[i].id,
                    target: newNodes[(i + 1) % newNodes.length].id,
                    type: 'smoothstep',
                    animated: true,
                    style: {
                        strokeWidth: 2,
                        stroke: '#94A3B8',
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#94A3B8',
                    },
                });
            }
        }

        return { nodes: newNodes, edges: newEdges };
    }, []);

    // Update graph when results change
    useEffect(() => {
        const { nodes: newNodes, edges: newEdges } = processResults(results);
        setNodes(newNodes);
        setEdges(newEdges);
    }, [results, processResults]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Export graph
    const exportGraph = () => {
        const graphData = {
            title,
            timestamp: new Date().toISOString(),
            nodes: nodes.map(node => ({
                id: node.id,
                entity: node.data.entity,
                database: node.data.database,
                entityType: node.data.entityType,
                position: node.position,
            })),
            edges: edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
            })),
        };

        const blob = new Blob([JSON.stringify(graphData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query-results-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!results || nodes.length === 0) {
        return (
            <div className={`bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${className}`}>
                <Eye className="mx-auto text-gray-400 mb-3" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Visualization Data</h3>
                <p className="text-gray-600">
                    Execute a query to see results visualized here.
                </p>
            </div>
        );
    }

    return (
        <ReactFlowProvider>
            <div className={`bg-white rounded-lg border ${className}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                        <Eye className="text-purple-600" size={20} />
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <span className="text-sm text-gray-500">
                            {nodes.length} nodes, {edges.length} edges
                        </span>
                    </div>

                    {showControls && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportGraph}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                title="Export Graph"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div
                    className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
                    style={{ height: isFullscreen ? '100vh' : height }}
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView
                        attributionPosition="bottom-left"
                        className="bg-gray-50"
                    >
                        <Controls showInteractive={false} />
                        <MiniMap
                            nodeColor={(node) => {
                                const db = node.data?.database;
                                if (db === 'both') return '#8B5CF6';
                                return db === 'memgraph' ? '#3B82F6' : '#EF4444';
                            }}
                            maskColor="rgba(255, 255, 255, 0.2)"
                            style={{ height: 80 }}
                        />
                        <Background variant="dots" gap={20} size={1} />
                    </ReactFlow>

                    {isFullscreen && (
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="absolute top-4 right-4 p-2 bg-white shadow-lg rounded-full hover:bg-gray-50"
                        >
                            <Minimize2 size={20} />
                        </button>
                    )}
                </div>
            </div>
        </ReactFlowProvider>
    );
};

export default GraphResultsVisualizer;