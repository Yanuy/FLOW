// 工作流执行引擎
class WorkflowExecutor {
    constructor() {
        this.isRunning = false;
        this.currentExecution = null;
        this.executionHistory = [];
        this.maxHistorySize = 50;
    }
    
    // 执行工作流
    async executeWorkflow() {
        if (this.isRunning) {
            Utils.showNotification('工作流正在执行中', 'warning');
            return;
        }
        
        const nodes = Array.from(window.workflowManager.nodes.values());
        if (nodes.length === 0) {
            Utils.showNotification('没有节点可执行', 'warning');
            return;
        }
        
        this.isRunning = true;
        this.currentExecution = {
            id: Utils.generateId('exec_'),
            startTime: new Date(),
            status: 'running',
            results: new Map(),
            errors: []
        };
        
        // 创建执行上下文
        window.variableManager.createExecutionContext(this.currentExecution.id);
        
        this.showExecutionStatus();
        this.updateExecutionButtons(true);
        
        try {
            // 重置所有节点状态
            nodes.forEach(node => {
                node.updateStatus('idle');
                node.inputs = {};
                node.outputs = {};
            });
            
            // 找到起始节点（没有输入连接的节点）
            const startNodes = this.findStartNodes();
            
            if (startNodes.length === 0) {
                throw new Error('没有找到起始节点（没有输入连接的节点）');
            }
            
            this.addExecutionLog('开始执行工作流', 'info');
            this.addExecutionLog(`找到 ${startNodes.length} 个起始节点`, 'info');
            
            // 执行工作流
            const results = await this.executeNodes(startNodes);
            
            this.currentExecution.status = 'completed';
            this.currentExecution.endTime = new Date();
            this.currentExecution.results = results;
            
            this.addExecutionLog('工作流执行完成', 'success');
            Utils.showNotification('工作流执行完成', 'success');
            
        } catch (error) {
            console.error('工作流执行错误:', error);
            
            this.currentExecution.status = 'error';
            this.currentExecution.endTime = new Date();
            this.currentExecution.errors.push({
                message: error.message,
                time: new Date()
            });
            
            this.addExecutionLog(`执行错误: ${error.message}`, 'error');
            Utils.showNotification('工作流执行失败: ' + error.message, 'error');
        } finally {
            this.isRunning = false;
            this.updateExecutionButtons(false);
            
            // 清理执行上下文
            if (this.currentExecution) {
                window.variableManager.cleanupExecutionContext(this.currentExecution.id);
            }
            
            // 保存执行历史
            this.saveExecutionHistory();
        }
    }
    
    // 停止执行
    stopExecution() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        
        if (this.currentExecution) {
            this.currentExecution.status = 'stopped';
            this.currentExecution.endTime = new Date();
        }
        
        // 重置所有节点状态
        window.workflowManager.nodes.forEach(node => {
            node.updateStatus('idle');
        });
        
        this.addExecutionLog('工作流执行已停止', 'warning');
        this.updateExecutionButtons(false);
        
        Utils.showNotification('工作流执行已停止', 'warning');
    }
    
    // 找到起始节点
    findStartNodes() {
        const allNodes = Array.from(window.workflowManager.nodes.values());
        const nodesWithInputs = new Set();
        
        // 找到所有有输入连接的节点
        window.workflowManager.connections.forEach(connection => {
            nodesWithInputs.add(connection.to.nodeId);
        });
        
        // 返回没有输入连接的节点
        return allNodes.filter(node => !nodesWithInputs.has(node.id));
    }
    
    // 执行节点
    async executeNodes(nodes) {
        const results = new Map();
        const executed = new Set();
        const executing = new Set();
        
        // 递归执行节点及其依赖
        const executeNodeRecursive = async (node) => {
            if (executed.has(node.id) || executing.has(node.id)) {
                return results.get(node.id);
            }
            
            if (!this.isRunning) {
                throw new Error('执行已停止');
            }
            
            executing.add(node.id);
            
            try {
                this.addExecutionLog(`开始执行节点: ${node.getNodeInfo().title} (${node.id})`, 'info');
                
                // 获取输入（这里会等待弹窗处理完成）
                const resolvedInputs = await window.variableManager.resolveNodeInputs(node.id, node);
                
                // 将解析后的输入设置到节点中
                Object.keys(resolvedInputs).forEach(inputName => {
                    node.inputs[inputName] = resolvedInputs[inputName];
                });
                
                // 执行节点
                const result = await node.execute();
                
                // 保存节点结果到执行上下文
                window.variableManager.saveNodeResult(
                    this.currentExecution.id, 
                    node.id, 
                    resolvedInputs, 
                    result, 
                    'success'
                );
                
                results.set(node.id, result);
                executed.add(node.id);
                executing.delete(node.id);
                
                this.addExecutionLog(`节点执行完成: ${node.getNodeInfo().title}`, 'success');
                
                // 执行后续节点
                const nextNodes = this.getNextNodes(node.id);
                for (const nextNode of nextNodes) {
                    await executeNodeRecursive(nextNode);
                }
                
                return result;
                
            } catch (error) {
                executing.delete(node.id);
                node.updateStatus('error');
                
                // 保存错误结果到执行上下文
                window.variableManager.saveNodeResult(
                    this.currentExecution.id, 
                    node.id, 
                    {}, 
                    {}, 
                    'error',
                    error
                );
                
                this.addExecutionLog(`节点执行失败: ${node.getNodeInfo().title} - ${error.message}`, 'error');
                throw error;
            }
        };
        
        // 并行执行所有起始节点
        await Promise.all(nodes.map(node => executeNodeRecursive(node)));
        
        return results;
    }
    
    // 获取节点的后续节点
    getNextNodes(nodeId) {
        const nextNodes = [];
        const node = window.workflowManager.nodes.get(nodeId);
        
        if (!node) return nextNodes;
        
        // 遍历节点的输出连接
        node.connections.outputs.forEach((connections, outputName) => {
            connections.forEach(connection => {
                const nextNode = window.workflowManager.nodes.get(connection.toNode);
                if (nextNode && !nextNodes.includes(nextNode)) {
                    nextNodes.push(nextNode);
                }
            });
        });
        
        return nextNodes;
    }
    
    // 显示执行状态面板
    showExecutionStatus() {
        const statusPanel = document.getElementById('executionStatus');
        statusPanel.classList.remove('hidden');
        
        // 清空之前的内容
        const statusContent = document.getElementById('statusContent');
        statusContent.innerHTML = '';
    }
    
    // 隐藏执行状态面板
    hideExecutionStatus() {
        const statusPanel = document.getElementById('executionStatus');
        statusPanel.classList.add('hidden');
    }
    
    // 添加执行日志
    addExecutionLog(message, type = 'info') {
        const statusContent = document.getElementById('statusContent');
        const time = Utils.formatTime();
        
        const logItem = document.createElement('div');
        logItem.className = 'status-item';
        logItem.innerHTML = `
            <i class="status-icon ${type} ${this.getIconClass(type)}"></i>
            <span class="status-text">${Utils.escapeHtml(message)}</span>
            <span class="status-time">${time}</span>
        `;
        
        statusContent.appendChild(logItem);
        statusContent.scrollTop = statusContent.scrollHeight;
    }
    
    // 获取图标类名
    getIconClass(type) {
        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            running: 'fas fa-spinner fa-spin'
        };
        return icons[type] || icons.info;
    }
    
    // 更新执行按钮状态
    updateExecutionButtons(isRunning) {
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        playBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        
        if (isRunning) {
            playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中';
        } else {
            playBtn.innerHTML = '<i class="fas fa-play"></i> 执行';
        }
    }
    
    // 保存执行历史
    saveExecutionHistory() {
        if (this.currentExecution) {
            this.executionHistory.unshift(this.currentExecution);
            
            // 限制历史记录数量
            if (this.executionHistory.length > this.maxHistorySize) {
                this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
            }
            
            // 保存到本地存储
            try {
                localStorage.setItem('ai-workflow-execution-history', 
                    JSON.stringify(this.executionHistory.slice(0, 10))); // 只保存最近10次
            } catch (error) {
                console.warn('保存执行历史失败:', error);
            }
        }
    }
    
    // 加载执行历史
    loadExecutionHistory() {
        try {
            const saved = localStorage.getItem('ai-workflow-execution-history');
            if (saved) {
                this.executionHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('加载执行历史失败:', error);
            this.executionHistory = [];
        }
    }
    
    // 获取执行统计
    getExecutionStats() {
        const total = this.executionHistory.length;
        const successful = this.executionHistory.filter(exec => exec.status === 'completed').length;
        const failed = this.executionHistory.filter(exec => exec.status === 'error').length;
        const stopped = this.executionHistory.filter(exec => exec.status === 'stopped').length;
        
        return {
            total,
            successful,
            failed,
            stopped,
            successRate: total > 0 ? (successful / total * 100).toFixed(1) : 0
        };
    }
    
    // 清空执行历史
    clearExecutionHistory() {
        this.executionHistory = [];
        localStorage.removeItem('ai-workflow-execution-history');
        Utils.showNotification('执行历史已清空', 'info');
    }
    
    // 导出执行结果
    exportExecutionResults() {
        if (!this.currentExecution) {
            Utils.showNotification('没有执行结果可导出', 'warning');
            return;
        }
        
        const results = {
            execution: {
                id: this.currentExecution.id,
                startTime: this.currentExecution.startTime,
                endTime: this.currentExecution.endTime,
                status: this.currentExecution.status,
                duration: this.currentExecution.endTime ? 
                    this.currentExecution.endTime - this.currentExecution.startTime : null
            },
            results: Object.fromEntries(this.currentExecution.results || new Map()),
            errors: this.currentExecution.errors || []
        };
        
        const filename = `execution_results_${this.currentExecution.id}.json`;
        Utils.downloadFile(JSON.stringify(results, null, 2), filename);
        
        Utils.showNotification('执行结果已导出', 'success');
    }
    
    // 验证工作流
    validateWorkflow() {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        const nodes = Array.from(window.workflowManager.nodes.values());
        const connections = Array.from(window.workflowManager.connections.values());
        
        // 检查是否有节点
        if (nodes.length === 0) {
            validation.isValid = false;
            validation.errors.push('工作流中没有节点');
            return validation;
        }
        
        // 检查起始节点
        const startNodes = this.findStartNodes();
        if (startNodes.length === 0) {
            validation.isValid = false;
            validation.errors.push('没有起始节点（所有节点都有输入连接）');
        }
        
        // 检查孤立节点
        const connectedNodes = new Set();
        connections.forEach(conn => {
            connectedNodes.add(conn.from.nodeId);
            connectedNodes.add(conn.to.nodeId);
        });
        
        const isolatedNodes = nodes.filter(node => 
            !connectedNodes.has(node.id) && nodes.length > 1
        );
        
        if (isolatedNodes.length > 0) {
            validation.warnings.push(`发现 ${isolatedNodes.length} 个孤立节点`);
        }
        
        // 检查循环依赖
        const cycles = this.detectCycles();
        if (cycles.length > 0) {
            validation.isValid = false;
            validation.errors.push(`检测到循环依赖: ${cycles.join(', ')}`);
        }
        
        // 检查节点配置
        nodes.forEach(node => {
            const nodeValidation = this.validateNodeConfiguration(node);
            if (!nodeValidation.isValid) {
                validation.warnings.push(`节点 ${node.getNodeInfo().title} (${node.id}) 配置不完整`);
            }
        });
        
        return validation;
    }
    
    // 检测循环依赖
    detectCycles() {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        
        const dfs = (nodeId, path = []) => {
            if (recursionStack.has(nodeId)) {
                // 找到循环
                const cycleStart = path.indexOf(nodeId);
                cycles.push(path.slice(cycleStart).concat(nodeId));
                return;
            }
            
            if (visited.has(nodeId)) {
                return;
            }
            
            visited.add(nodeId);
            recursionStack.add(nodeId);
            
            const node = window.workflowManager.nodes.get(nodeId);
            if (node) {
                const nextNodes = this.getNextNodes(nodeId);
                nextNodes.forEach(nextNode => {
                    dfs(nextNode.id, path.concat(nodeId));
                });
            }
            
            recursionStack.delete(nodeId);
        };
        
        window.workflowManager.nodes.forEach((node, nodeId) => {
            if (!visited.has(nodeId)) {
                dfs(nodeId);
            }
        });
        
        return cycles;
    }
    
    // 验证节点配置
    validateNodeConfiguration(node) {
        const validation = { isValid: true, errors: [] };
        
        switch (node.type) {
            case 'ai-chat':
            case 'ai-text-generation':
            case 'ai-text-analysis':
                if (!node.config.prompt || node.config.prompt.trim() === '') {
                    validation.isValid = false;
                    validation.errors.push('缺少提示词');
                }
                break;
                
            case 'file-output':
                if (!node.config.filename || node.config.filename.trim() === '') {
                    validation.isValid = false;
                    validation.errors.push('缺少输出文件名');
                }
                break;
                
            case 'http-request':
                if (!node.config.url || node.config.url.trim() === '') {
                    validation.isValid = false;
                    validation.errors.push('缺少请求URL');
                }
                break;
                
            case 'condition':
                if (!node.config.condition && node.config.operator !== 'empty' && node.config.operator !== 'not_empty') {
                    validation.isValid = false;
                    validation.errors.push('缺少条件值');
                }
                break;
        }
        
        return validation;
    }
    
    // 模拟执行（用于测试和预览）
    async simulateExecution() {
        const validation = this.validateWorkflow();
        
        if (!validation.isValid) {
            Utils.showNotification('工作流验证失败: ' + validation.errors.join(', '), 'error');
            return;
        }
        
        if (validation.warnings.length > 0) {
            const proceed = await Utils.confirm(
                '工作流存在警告:\n' + validation.warnings.join('\n') + '\n\n是否继续模拟执行?',
                '工作流验证警告'
            );
            
            if (!proceed) {
                return;
            }
        }
        
        Utils.showNotification('工作流验证通过，可以执行', 'success');
        
        // 显示执行计划
        this.showExecutionPlan();
    }
    
    // 显示执行计划
    showExecutionPlan() {
        const startNodes = this.findStartNodes();
        const executionOrder = this.getExecutionOrder(startNodes);
        
        let planText = '执行计划:\n\n';
        executionOrder.forEach((batch, index) => {
            planText += `批次 ${index + 1}:\n`;
            batch.forEach(node => {
                planText += `  - ${node.getNodeInfo().title} (${node.id})\n`;
            });
            planText += '\n';
        });
        
        Utils.showNotification('查看控制台了解执行计划', 'info');
        console.log(planText);
    }
    
    // 获取执行顺序
    getExecutionOrder(startNodes) {
        const executionOrder = [];
        const processed = new Set();
        let currentBatch = [...startNodes];
        
        while (currentBatch.length > 0) {
            executionOrder.push([...currentBatch]);
            
            // 标记当前批次的节点为已处理
            currentBatch.forEach(node => processed.add(node.id));
            
            // 找到下一批次的节点
            const nextBatch = [];
            currentBatch.forEach(node => {
                const nextNodes = this.getNextNodes(node.id);
                nextNodes.forEach(nextNode => {
                    if (!processed.has(nextNode.id) && !nextBatch.includes(nextNode)) {
                        // 检查节点的所有依赖是否都已处理
                        const dependencies = this.getNodeDependencies(nextNode.id);
                        const allDependenciesProcessed = dependencies.every(dep => processed.has(dep));
                        
                        if (allDependenciesProcessed) {
                            nextBatch.push(nextNode);
                        }
                    }
                });
            });
            
            currentBatch = nextBatch;
        }
        
        return executionOrder;
    }
    
    // 获取节点依赖
    getNodeDependencies(nodeId) {
        const dependencies = [];
        const node = window.workflowManager.nodes.get(nodeId);
        
        if (node) {
            node.connections.inputs.forEach((connection, inputName) => {
                if (!dependencies.includes(connection.fromNode)) {
                    dependencies.push(connection.fromNode);
                }
            });
        }
        
        return dependencies;
    }
}

// 创建全局执行器实例
window.workflowExecutor = new WorkflowExecutor();