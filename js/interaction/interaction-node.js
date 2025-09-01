// 统一交互节点基类，支持多类型交互窗口（对话、IDE、音频、图片等）
class InteractionNode extends WorkflowNode {
    constructor(type, data = {}) {
        // 确保正确传递参数给WorkflowNode
        super(type, data);
        this.interactionType = data.interactionType || 'chat'; // chat, ide, audio, image, video, ...
        this.uiMode = data.uiMode || 'normal'; // normal, minimized, detached
        this.nodeStatus = 'idle';
    }

    // 统一头部渲染
    getHeaderHTML() {
        return `
            <div class="interaction-header">
                <span class="interaction-title">${this.config.title || '交互节点'}</span>
                <div class="interaction-actions">
                    <button class="minimize-btn" title="最小化"><i class="fa fa-minus"></i></button>
                    <button class="detach-btn" title="分离窗口"><i class="fa fa-external-link"></i></button>
                    <button class="close-btn" title="关闭"><i class="fa fa-times"></i></button>
                </div>
            </div>
        `;
    }

    // 统一设置面板入口
    getSettingsPanelHTML() {
        return `<div class="interaction-settings-panel">设置面板（可扩展）</div>`;
    }

    // 统一输入输出模式切换
    getIOModePanelHTML() {
        return `
            <div class="io-mode-panel">
                <label>输入模式:
                    <select class="input-mode-select">
                        <option value="manual">手动</option>
                        <option value="stream">流处理</option>
                    </select>
                </label>
                <label>输出模式:
                    <select class="output-mode-select">
                        <option value="manual">手动</option>
                        <option value="auto">自动</option>
                    </select>
                </label>
            </div>
        `;
    }

    // 统一内容区（子类重写）
    getNodeContentHTML() {
        return '<div class="interaction-content">内容区（子类实现）</div>';
    }

    // 获取解析后的输入（兼容方法）
    getResolvedInputs() {
        // 如果父类有这个方法，使用父类的
        if (super.getResolvedInputs) {
            return super.getResolvedInputs();
        }

        // 否则使用基本的输入获取
        const inputs = {};
        Object.keys(this.getInputs()).forEach(inputName => {
            inputs[inputName] = this.getInputValue(inputName);
        });
        return inputs;
    }

    // 获取输入值（兼容方法）
    getInputValue(inputName) {
        if (super.getInputValue) {
            return super.getInputValue(inputName);
        }
        return this.inputs[inputName] || null;
    }
}

// 预留全局导出
window.InteractionNode = InteractionNode;
