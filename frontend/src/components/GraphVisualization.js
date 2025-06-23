import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import io from 'socket.io-client';

const GraphVisualization = () => {
    const svgRef = useRef();
    const socketRef = useRef();
    const simulationRef = useRef();
    const [activeDatabase, setActiveDatabase] = useState(null);
    const [metrics, setMetrics] = useState({
        oracle: { loadTime: 0, queryTime: 0, memoryUsage: 0 },
        memgraph: { loadTime: 0, queryTime: 0, memoryUsage: 0 }
    });

    useEffect(() => {
        // Initialize socket connection
        socketRef.current = io('http://localhost:5000/', { transports: ['websocket'] });

        // Socket event handlers
        socketRef.current.on('connect', () => {
            console.log('Connected to socket', socketRef.current.id);
        });

        socketRef.current.on('connect_error', (err) => {
            console.log(err);
            socketRef.current.connect();
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected from socket.');
        });

        socketRef.current.on('graph_update', (data) => {
            updateGraph(data.nodes, data.links);
        });

        socketRef.current.on('performance_metrics', (data) => {
            setMetrics(prev => ({
                ...prev,
                [data.database]: {
                    loadTime: data.loadTime,
                    queryTime: data.queryTime,
                    memoryUsage: data.memoryUsage
                }
            }));
        });

        // Initialize D3 visualization
        initializeGraph();

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (simulationRef.current) {
                simulationRef.current.stop();
            }
        };
    }, []);

    const handleDatabaseSelect = (database) => {
        setActiveDatabase(database);
        socketRef.current.emit('select_database', { database });
    };

    const initializeGraph = () => {
        const width = 1000;
        const height = 700;
        const svg = d3.select(svgRef.current);

        // Clear any existing content
        svg.selectAll('*').remove();

        // Create tooltip
        const tooltip = d3.select('body')
            .append('div')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('padding', '10px')
            .style('border-radius', '5px');

        // Initialize simulation
        simulationRef.current = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Create gradient for node colors
        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('style', 'stop-color: #ff7f0e');

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('style', 'stop-color: #1f77b4');
    };

    const updateGraph = (nodes, links) => {
        const svg = d3.select(svgRef.current);
        const width = 1000;
        const height = 700;

        // Update links
        const link = svg.selectAll('.link')
            .data(links, d => `${d.source.id}-${d.target.id}`);

        link.exit().remove();

        const linkEnter = link.enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);

        link = linkEnter.merge(link);

        // Update nodes
        const node = svg.selectAll('.node')
            .data(nodes, d => d.id);

        node.exit().remove();

        const nodeEnter = node.enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', 5)
            .attr('fill', 'url(#gradient)')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        node = nodeEnter.merge(node);

        // Add tooltips
        node.on('mouseover', function(event, d) {
            tooltip.style('visibility', 'visible')
                .text(d.name || d.id)
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mousemove', function(event) {
            tooltip.style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
        });

        // Update simulation
        simulationRef.current.nodes(nodes);
        simulationRef.current.force('link').links(links);
        simulationRef.current.alpha(1).restart();

        // Update positions on each tick
        simulationRef.current.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
        });
    };

    const dragstarted = (event, d) => {
        if (!event.active) simulationRef.current.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    };

    const dragged = (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
    };

    const dragended = (event, d) => {
        if (!event.active) simulationRef.current.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    };

    return (
        <div className="graph-container">
            <h1>Knowledge Graph Visualization</h1>
            
            <div className="database-controls">
                <button 
                    className={`db-button ${activeDatabase === 'oracle' ? 'active' : ''}`}
                    onClick={() => handleDatabaseSelect('oracle')}
                >
                    Oracle Graph
                </button>
                <button 
                    className={`db-button ${activeDatabase === 'memgraph' ? 'active' : ''}`}
                    onClick={() => handleDatabaseSelect('memgraph')}
                >
                    Memgraph
                </button>
            </div>

            <div className="metrics-container">
                <div className="metrics-card">
                    <h3>Oracle Graph Metrics</h3>
                    <div className="metric">
                        <span>Load Time:</span>
                        <span>{metrics.oracle.loadTime}ms</span>
                    </div>
                    <div className="metric">
                        <span>Query Time:</span>
                        <span>{metrics.oracle.queryTime}ms</span>
                    </div>
                    <div className="metric">
                        <span>Memory Usage:</span>
                        <span>{metrics.oracle.memoryUsage}MB</span>
                    </div>
                </div>

                <div className="metrics-card">
                    <h3>Memgraph Metrics</h3>
                    <div className="metric">
                        <span>Load Time:</span>
                        <span>{metrics.memgraph.loadTime}ms</span>
                    </div>
                    <div className="metric">
                        <span>Query Time:</span>
                        <span>{metrics.memgraph.queryTime}ms</span>
                    </div>
                    <div className="metric">
                        <span>Memory Usage:</span>
                        <span>{metrics.memgraph.memoryUsage}MB</span>
                    </div>
                </div>
            </div>

            <svg
                ref={svgRef}
                width={1000}
                height={700}
                style={{
                    background: 'white',
                    margin: '20px auto',
                    display: 'block'
                }}
            />
        </div>
    );
};

export default GraphVisualization; 