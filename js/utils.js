// 工具函数模块
class Utils {
    // 生成唯一ID
    static generateId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // 深度克隆对象
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = Utils.deepClone(obj[key]);
            });
            return cloned;
        }
    }
    
    // 防抖函数
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 节流函数
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // 格式化时间
    static formatTime(date = new Date()) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // 格式化文件大小
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 获取文件扩展名
    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }
    
    // 验证JSON格式
    static isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // 转义HTML
    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    // 计算两点之间的距离
    static distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
    
    // 检查点是否在矩形内
    static pointInRect(point, rect) {
        return point.x >= rect.x && 
               point.x <= rect.x + rect.width &&
               point.y >= rect.y && 
               point.y <= rect.y + rect.height;
    }
    
    // 下载文件
    static downloadFile(content, filename, type = 'application/json') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 读取文件内容
    static readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    // 读取文件为Base64
    static readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // 显示通知
    static showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: '500',
            zIndex: '5000',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });
        
        // 设置背景色
        const colors = {
            info: '#007bff',
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // 显示动画
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // 自动隐藏
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
    
    // 显示确认对话框
    static confirm(message, title = '确认') {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${Utils.escapeHtml(title)}</h2>
                    </div>
                    <div class="modal-body">
                        <p>${Utils.escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">取消</button>
                        <button class="btn btn-primary confirm-btn">确认</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.classList.add('show');
            
            const cleanup = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }, 300);
            };
            
            modal.querySelector('.cancel-btn').onclick = () => {
                cleanup();
                resolve(false);
            };
            
            modal.querySelector('.confirm-btn').onclick = () => {
                cleanup();
                resolve(true);
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    }
    
    // 显示模态框
    static showModal(title, content, buttons = []) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let buttonsHTML = '';
        if (buttons.length > 0) {
            buttonsHTML = '<div class="modal-footer">';
            buttons.forEach(button => {
                const btnClass = button.type === 'primary' ? 'btn-primary' : 
                               button.type === 'warning' ? 'btn-warning' :
                               button.type === 'danger' ? 'btn-danger' : 'btn-secondary';
                buttonsHTML += `<button type="button" class="btn ${btnClass}" data-action="${button.onclick ? 'custom' : 'close'}">${button.text}</button>`;
            });
            buttonsHTML += '</div>';
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${Utils.escapeHtml(title)}</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${buttonsHTML}
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.add('show');
        
        // 设置z-index确保新模态框在最前面
        const existingModals = document.querySelectorAll('.modal.show');
        const baseZIndex = 2000; // 提高基础z-index，确保在变量管理窗口之上
        modal.style.zIndex = baseZIndex + existingModals.length;
        
        // 绑定事件
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => Utils.hideModal(modal);
        
        // 添加拖拽功能
        Utils.makeDraggable(modal);
        
        // 绑定按钮事件
        const modalButtons = modal.querySelectorAll('.modal-footer .btn');
        modalButtons.forEach((btn, index) => {
            btn.onclick = () => {
                if (buttons[index] && buttons[index].onclick) {
                    buttons[index].onclick();
                } else {
                    Utils.hideModal(modal);
                }
            };
        });
        
        // 点击外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                Utils.hideModal(modal);
            }
        };
        
        return modal;
    }
    
    // 隐藏模态框
    static hideModal(modal = null) {
        if (!modal) {
            // 关闭最后创建的模态框（z-index最高）
            const modals = document.querySelectorAll('.modal.show');
            if (modals.length > 0) {
                modal = modals[modals.length - 1]; // 选择最后一个
            }
        }
        
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }
    
    // 使模态框可拖拽
    static makeDraggable(modal) {
        const header = modal.querySelector('.modal-header');
        if (!header) return;
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        function dragStart(e) {
            if (e.target.closest('.close')) return; // 不在关闭按钮上拖拽
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                modal.style.position = 'fixed';
            }
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                // 限制在窗口范围内
                const maxX = window.innerWidth - modal.offsetWidth;
                const maxY = window.innerHeight - modal.offsetHeight;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));
                
                modal.style.transform = `translate(${currentX}px, ${currentY}px)`;
                modal.style.top = 'auto';
                modal.style.left = 'auto';
            }
        }
        
        function dragEnd() {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
    }
    
    // 创建贝塞尔曲线路径
    static createBezierPath(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        // 控制点偏移
        const cp1x = start.x + dx * 0.5;
        const cp1y = start.y;
        const cp2x = end.x - dx * 0.5;
        const cp2y = end.y;
        
        return `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`;
    }
    
    // 节流执行异步函数
    static async throttleAsync(asyncFn, limit) {
        let isRunning = false;
        return async function(...args) {
            if (isRunning) return;
            isRunning = true;
            try {
                return await asyncFn.apply(this, args);
            } finally {
                setTimeout(() => {
                    isRunning = false;
                }, limit);
            }
        };
    }
}