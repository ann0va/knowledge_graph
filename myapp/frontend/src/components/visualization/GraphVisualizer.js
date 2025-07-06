// src/components/visualization/GraphVisualizer.js - Intelligent Knowledge Graph Explorer
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
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Database,
    Search,
    RefreshCw,
    Eye,
    Download,
    Zap,
    Target,
    Layers,
    MapPin
} from 'lucide-react';
import apiService from '../../services/api';

// Custom Node Types
const EntityNode = ({ data, selected }) => {
    const { entity, database, entityType, connectionCount, isFocused } = data;

    const getNodeColor = () => {
        if (isFocused) return 'bg-gradient-to-r from-yellow-400 to-orange-500';
        if (database === 'both') return 'bg-gradient-to-r from-blue-500 to-red-500';
        return database === 'memgraph' ? 'bg-blue-500' : 'bg-red-500';
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

    const getNodeSize = () => {
        // Size based on connection count
        const baseSize = 150;
        const sizeMultiplier = Math.min(connectionCount / 5, 3); // Max 3x size
        return Math.max(baseSize, baseSize + sizeMultiplier * 50);
    };

    const nodeWidth = getNodeSize();

    return (
        <div
            className={`px-4 py-2 shadow-lg rounded-lg border-2 ${
                selected ? 'border-yellow-400' : isFocused ? 'border-orange-400' : 'border-gray-300'
            } bg-white relative`}
            style={{ minWidth: `${nodeWidth}px` }}
        >
            {/* Handles */}
            <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
            <Handle type="target" position={Position.Left} style={{ background: '#555' }} />

            {/* Focus indicator */}
            {isFocused && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <Target size={12} className="text-white" />
                </div>
            )}

            <div className={`w-full h-1 ${getNodeColor()} rounded-t mb-2`}></div>

            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getEntityIcon()}</span>
                <span className="font-medium text-sm text-gray-800 truncate">
                    {entity.name || 'Unknown'}
                </span>
                {connectionCount > 0 && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                        {connectionCount}
                    </span>
                )}
            </div>

            <div className="text-xs text-gray-500">
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

const GraphVisualizer = () => {
    return (
        <ReactFlowProvider>
            <GraphVisualizerContent />
        </ReactFlowProvider>
    );
};

const GraphVisualizerContent = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [allNodes, setAllNodes] = useState([]); // Store all loaded nodes
    const [allEdges, setAllEdges] = useState([]); // Store all loaded edges
    const [loading, setLoading] = useState(false);
    const [selectedDatabase, setSelectedDatabase] = useState('both');
    const [selectedEntityType, setSelectedEntityType] = useState('person');
    const [searchTerm, setSearchTerm] = useState('');
    const [focusEntity, setFocusEntity] = useState(''); // Entity to focus on
    const [hopDepth, setHopDepth] = useState(0); // 0 = all, 1 = 1-hop, 2 = 2-hop
    const [layoutType, setLayoutType] = useState('force');

    // Intelligent Layout Algorithms
    const calculateIntelligentLayout = useCallback((nodes, edges, type = 'force') => {
        if (type === 'centrality') {
            // Layout based on node importance (connection count)
            const nodeConnections = new Map();

            // Count connections for each node
            nodes.forEach(node => {
                const connections = edges.filter(edge =>
                    edge.source === node.id || edge.target === node.id
                ).length;
                nodeConnections.set(node.id, connections);
            });

            // Sort nodes by connection count
            const sortedNodes = [...nodes].sort((a, b) =>
                (nodeConnections.get(b.id) || 0) - (nodeConnections.get(a.id) || 0)
            );

            // Create concentric circles based on importance
            return sortedNodes.map((node, index) => {
                const totalNodes = sortedNodes.length;
                const ring = Math.floor(index / 8); // 8 nodes per ring
                const angleStep = (2 * Math.PI) / Math.min(8, totalNodes - ring * 8);
                const angle = (index % 8) * angleStep;
                const radius = 150 + ring * 200;

                return {
                    ...node,
                    position: {
                        x: Math.cos(angle) * radius + 400,
                        y: Math.sin(angle) * radius + 300,
                    },
                    data: {
                        ...node.data,
                        connectionCount: nodeConnections.get(node.id) || 0,
                    }
                };
            });
        } else if (type === 'circular') {
            return nodes.map((node, index) => {
                const angle = (index / nodes.length) * 2 * Math.PI;
                const radius = Math.max(200, nodes.length * 15);
                return {
                    ...node,
                    position: {
                        x: Math.cos(angle) * radius + 400,
                        y: Math.sin(angle) * radius + 300,
                    },
                };
            });
        } else if (type === 'grid') {
            const cols = Math.ceil(Math.sqrt(nodes.length));
            return nodes.map((node, index) => ({
                ...node,
                position: {
                    x: (index % cols) * 250 + 100,
                    y: Math.floor(index / cols) * 200 + 100,
                },
            }));
        } else {
            // Force-directed with some intelligence
            const nodeConnections = new Map();
            edges.forEach(edge => {
                nodeConnections.set(edge.source, (nodeConnections.get(edge.source) || 0) + 1);
                nodeConnections.set(edge.target, (nodeConnections.get(edge.target) || 0) + 1);
            });

            return nodes.map((node, index) => {
                const connections = nodeConnections.get(node.id) || 0;
                const centerDistance = 200 + Math.random() * 400;
                const angle = Math.random() * 2 * Math.PI;

                return {
                    ...node,
                    position: {
                        x: Math.cos(angle) * centerDistance + 400 + (Math.random() - 0.5) * 100,
                        y: Math.sin(angle) * centerDistance + 300 + (Math.random() - 0.5) * 100,
                    },
                    data: {
                        ...node.data,
                        connectionCount: connections,
                    }
                };
            });
        }
    }, []);

    // Helper functions
    const extractEntityId = useCallback((entity, database) => {
        if (database === 'oracle') {
            if (entity.id) return entity.id;
            if (entity.ID) return entity.ID;
            if (entity.VERTEX_ID) {
                const match = entity.VERTEX_ID.match(/\(([^)]+)\)/);
                return match ? match[1] : entity.VERTEX_ID;
            }
        } else {
            if (entity['e.id']) return entity['e.id'];
            if (entity.id) return entity.id;
        }
        return null;
    }, []);

    const extractEntityName = useCallback((entity, database) => {
        if (database === 'oracle') {
            return entity.NAME || entity.name || entity.label;
        } else {
            return entity['e.name'] || entity.name || entity.label;
        }
    }, []);

    // Filter nodes and edges based on focus entity and hop depth
    const applyFocusFilter = useCallback((allNodes, allEdges, focusEntityId, depth) => {
        if (!focusEntityId || depth === 0) {
            // Show all
            return {
                filteredNodes: allNodes,
                filteredEdges: allEdges
            };
        }

        const focusNodeId = `entity-${focusEntityId}`;
        const includedNodes = new Set([focusNodeId]);
        const includedEdges = [];

        // Find nodes within hop depth
        for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
            const currentLevelNodes = new Set();

            allEdges.forEach(edge => {
                if (includedNodes.has(edge.source) && !includedNodes.has(edge.target)) {
                    currentLevelNodes.add(edge.target);
                    includedEdges.push(edge);
                }
                if (includedNodes.has(edge.target) && !includedNodes.has(edge.source)) {
                    currentLevelNodes.add(edge.source);
                    includedEdges.push(edge);
                }
            });

            currentLevelNodes.forEach(nodeId => includedNodes.add(nodeId));
        }

        const filteredNodes = allNodes.filter(node => includedNodes.has(node.id));
        const filteredEdges = includedEdges.filter(edge =>
            includedNodes.has(edge.source) && includedNodes.has(edge.target)
        );

        // Mark focus node
        const finalNodes = filteredNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                isFocused: node.id === focusNodeId
            }
        }));

        return { filteredNodes: finalNodes, filteredEdges };
    }, []);

    // Load complete graph data
    const loadCompleteGraphData = useCallback(async () => {
        setLoading(true);
        try {
            console.log('🔄 Loading complete graph data...');

            // Load all entity types for a comprehensive view
            const entityTypes = ['person', 'place', 'work', 'award', 'field', 'occupation', 'workplace'];
            const allEntities = [];
            const allRelationships = [];

            for (const entityType of entityTypes) {
                console.log(`📊 Loading ${entityType} entities...`);

                if (selectedDatabase === 'both') {
                    const [memgraphResult, oracleResult] = await Promise.allSettled([
                        apiService.searchEntityNames(entityType, searchTerm, 'memgraph', 15),
                        apiService.searchEntityNames(entityType, searchTerm, 'oracle', 15)
                    ]);

                    // Process results
                    [memgraphResult, oracleResult].forEach((result, index) => {
                        const database = index === 0 ? 'memgraph' : 'oracle';
                        if (result.status === 'fulfilled' && result.value.success) {
                            const entities = result.value.data.results.map(entity => {
                                const id = extractEntityId(entity, database);
                                const name = extractEntityName(entity, database);
                                return {
                                    id, name, database, entityType,
                                    rawEntity: entity
                                };
                            }).filter(entity => entity.id && entity.name);

                            allEntities.push(...entities);
                        }
                    });
                } else {
                    const result = await apiService.searchEntityNames(entityType, searchTerm, selectedDatabase, 30);
                    if (result.success) {
                        const entities = result.data.results.map(entity => {
                            const id = extractEntityId(entity, selectedDatabase);
                            const name = extractEntityName(entity, selectedDatabase);
                            return {
                                id, name,
                                database: selectedDatabase,
                                entityType,
                                rawEntity: entity
                            };
                        }).filter(entity => entity.id && entity.name);

                        allEntities.push(...entities);
                    }
                }
            }

            console.log(`✅ Loaded ${allEntities.length} entities total`);

            // Deduplicate entities
            const entityMap = new Map();
            allEntities.forEach(entity => {
                const key = entity.name.toLowerCase().trim();
                if (entityMap.has(key)) {
                    entityMap.get(key).database = 'both';
                } else {
                    entityMap.set(key, entity);
                }
            });
            const uniqueEntities = Array.from(entityMap.values());

            // Create nodes
            const newNodes = uniqueEntities.map((entity, index) => ({
                id: `entity-${entity.id}`,
                type: 'entityNode',
                data: {
                    entity,
                    database: entity.database,
                    entityType: entity.entityType,
                    connectionCount: 0,
                    isFocused: false,
                },
                position: { x: 0, y: 0 },
            }));

            // Load relationships for subset of entities
            console.log('🔗 Loading relationships...');
            const entitySample = uniqueEntities.slice(0, 20); // Sample for relationships

            for (const entity of entitySample) {
                try {
                    const targetDatabase = entity.database === 'both' ? 'memgraph' : entity.database;
                    const relationshipsResult = await apiService.getEntityRelationships(
                        entity.entityType,
                        entity.id,
                        null,
                        targetDatabase
                    );

                    if (relationshipsResult.success && relationshipsResult.data.relationships) {
                        const outgoing = relationshipsResult.data.relationships.outgoing || [];
                        const incoming = relationshipsResult.data.relationships.incoming || [];

                        // Process relationships
                        [...outgoing, ...incoming].forEach((rel, index) => {
                            let sourceId, targetId;

                            if (outgoing.includes(rel)) {
                                sourceId = entity.id;
                                targetId = rel.target_entity_id || rel.target_vertex_id || rel['target.id'];
                            } else {
                                sourceId = rel.source_entity_id || rel.source_vertex_id || rel['source.id'];
                                targetId = entity.id;
                            }

                            // Clean Oracle IDs
                            if (targetDatabase === 'oracle') {
                                if (targetId && targetId.includes('(')) {
                                    const match = targetId.match(/\(([^)]+)\)/);
                                    targetId = match ? match[1] : targetId;
                                }
                                if (sourceId && sourceId.includes('(')) {
                                    const match = sourceId.match(/\(([^)]+)\)/);
                                    sourceId = match ? match[1] : sourceId;
                                }
                            }

                            if (sourceId && targetId && sourceId !== 'null' && targetId !== 'null') {
                                allRelationships.push({
                                    id: `edge-${sourceId}-${targetId}-${rel.relationship_type || 'RELATED'}-${index}`,
                                    source: `entity-${sourceId}`,
                                    target: `entity-${targetId}`,
                                    type: 'smoothstep',
                                    label: rel.relationship_type || 'RELATED',
                                    animated: true,
                                    markerEnd: {
                                        type: MarkerType.ArrowClosed,
                                    },
                                    style: {
                                        strokeWidth: 2,
                                        stroke: targetDatabase === 'memgraph' ? '#3B82F6' : '#EF4444',
                                    },
                                });
                            }
                        });
                    }
                } catch (err) {
                    console.warn(`❌ Failed to load relationships for ${entity.name}:`, err);
                }
            }

            // Deduplicate relationships
            const edgeMap = new Map();
            const uniqueRelationships = [];

            allRelationships.forEach(edge => {
                const edgeKey = `${edge.source}-${edge.target}-${edge.label}`;
                if (!edgeMap.has(edgeKey)) {
                    edgeMap.set(edgeKey, true);
                    uniqueRelationships.push(edge);
                }
            });

            console.log(`🔗 Total unique relationships: ${uniqueRelationships.length}`);

            // Filter edges to only include those between existing nodes
            const nodeIds = new Set(newNodes.map(node => node.id));
            const validEdges = uniqueRelationships.filter(edge =>
                nodeIds.has(edge.source) && nodeIds.has(edge.target)
            );

            console.log(`✅ Final: ${newNodes.length} nodes, ${validEdges.length} edges`);

            // Store complete data
            setAllNodes(newNodes);
            setAllEdges(validEdges);

            // Apply initial filter
            const { filteredNodes, filteredEdges } = applyFocusFilter(newNodes, validEdges, focusEntity, hopDepth);

            // Apply layout
            const layoutedNodes = calculateIntelligentLayout(filteredNodes, filteredEdges, layoutType);

            setNodes(layoutedNodes);
            setEdges(filteredEdges);

        } catch (error) {
            console.error('❌ Failed to load graph data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedEntityType, selectedDatabase, searchTerm, layoutType, calculateIntelligentLayout, extractEntityId, extractEntityName, applyFocusFilter, focusEntity, hopDepth]);

    // Apply filters when focus or hop depth changes
    useEffect(() => {
        if (allNodes.length > 0) {
            const { filteredNodes, filteredEdges } = applyFocusFilter(allNodes, allEdges, focusEntity, hopDepth);
            const layoutedNodes = calculateIntelligentLayout(filteredNodes, filteredEdges, layoutType);
            setNodes(layoutedNodes);
            setEdges(filteredEdges);
        }
    }, [focusEntity, hopDepth, layoutType, allNodes, allEdges, applyFocusFilter, calculateIntelligentLayout]);

    // Auto-load on component mount and parameter changes
    useEffect(() => {
        loadCompleteGraphData();
    }, [loadCompleteGraphData]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Node click handler - set as focus entity
    const onNodeClick = useCallback((event, node) => {
        const entityId = node.data.entity.id;
        console.log('🖱️ Setting focus entity:', entityId);
        setFocusEntity(entityId);
        setHopDepth(1); // Auto-set to 1-hop when clicking
    }, []);

    // Export graph data
    const exportGraph = useCallback(() => {
        const graphData = {
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
                label: edge.label,
            })),
            metadata: {
                timestamp: new Date().toISOString(),
                focusEntity: focusEntity,
                hopDepth: hopDepth,
                database: selectedDatabase,
                totalNodes: nodes.length,
                totalEdges: edges.length,
            }
        };

        const blob = new Blob([JSON.stringify(graphData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `knowledge-graph-${focusEntity || 'complete'}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges, focusEntity, hopDepth, selectedDatabase]);

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Fixed Left Sidebar for Controls */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Database className="text-blue-600" size={20} />
                        <h3 className="font-semibold text-gray-900">Knowledge Graph Explorer</h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Intelligent Graph Visualization</p>
                </div>

                {/* Controls */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {/* Database Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Database</label>
                        <select
                            value={selectedDatabase}
                            onChange={(e) => setSelectedDatabase(e.target.value)}
                            className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="both">🔵🔴 Both Databases</option>
                            <option value="memgraph">🔵 Memgraph</option>
                            <option value="oracle">🔴 Oracle</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Global Search</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Filter all entities..."
                                className="w-full pl-10 pr-4 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Focus Entity */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Target size={14} />
                            Focus Entity
                        </label>
                        <input
                            type="text"
                            value={focusEntity}
                            onChange={(e) => setFocusEntity(e.target.value)}
                            placeholder="Entity ID (e.g., Q7251)"
                            className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-orange-500"
                        />
                    </div>

                    {/* Hop Depth */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Layers size={14} />
                            Exploration Depth
                        </label>
                        <select
                            value={hopDepth}
                            onChange={(e) => setHopDepth(parseInt(e.target.value))}
                            className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="0">🌐 Complete Graph</option>
                            <option value="1">1️⃣ Direct Connections (1-hop)</option>
                            <option value="2">2️⃣ Extended Network (2-hop)</option>
                            <option value="3">3️⃣ Broader Context (3-hop)</option>
                        </select>
                    </div>

                    {/* Layout Options */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Layout Algorithm</label>
                        <select
                            value={layoutType}
                            onChange={(e) => setLayoutType(e.target.value)}
                            className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="centrality">🎯 Centrality (by connections)</option>
                            <option value="force">🌀 Force Directed</option>
                            <option value="circular">⭕ Circular</option>
                            <option value="grid">📊 Grid</option>
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <button
                            onClick={loadCompleteGraphData}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? (
                                <RefreshCw size={14} className="animate-spin" />
                            ) : (
                                <Zap size={14} />
                            )}
                            {loading ? 'Loading...' : 'Refresh Complete Graph'}
                        </button>

                        <button
                            onClick={() => {
                                setFocusEntity('');
                                setHopDepth(0);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            <Eye size={14} />
                            Show All
                        </button>

                        <button
                            onClick={exportGraph}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                        >
                            <Download size={14} />
                            Export Graph
                        </button>
                    </div>
                </div>

                {/* Stats Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                            <span>Visible Nodes:</span>
                            <span className="font-medium">{nodes.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Visible Edges:</span>
                            <span className="font-medium">{edges.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Loaded:</span>
                            <span className="font-medium">{allNodes.length}N / {allEdges.length}E</span>
                        </div>
                        {focusEntity && (
                            <div className="flex justify-between text-orange-600">
                                <span>Focus:</span>
                                <span className="font-medium">{focusEntity}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Graph Area */}
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-left"
                    className="bg-gray-50"
                >
                    <Controls />
                    <MiniMap
                        nodeColor={(node) => {
                            if (node.data?.isFocused) return '#F59E0B';
                            const db = node.data?.database;
                            if (db === 'both') return '#8B5CF6';
                            return db === 'memgraph' ? '#3B82F6' : '#EF4444';
                        }}
                        className="bg-white border border-gray-300"
                        style={{ height: 120, width: 160 }}
                    />
                    <Background variant="dots" gap={20} size={1} />
                </ReactFlow>

                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
                        <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-lg">
                            <RefreshCw size={20} className="animate-spin text-blue-600" />
                            <span className="text-gray-700">Loading complete knowledge graph...</span>
                        </div>
                    </div>
                )}

                {/* Instructions Overlay */}
                {!focusEntity && hopDepth === 0 && nodes.length > 0 && (
                    <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border max-w-xs">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                            <MapPin size={16} />
                            Navigation Tips
                        </h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Click any node to focus on it</li>
                            <li>• Use hop depth to explore connections</li>
                            <li>• Larger nodes have more connections</li>
                            <li>• Orange nodes are your focus entity</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GraphVisualizer;