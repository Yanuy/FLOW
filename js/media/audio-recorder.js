// 音频录制窗口组件 - 实时音频处理
class AudioRecorderWindow {
    constructor(config = {}) {
        this.id = config.id || Utils.generateId('audio_');
        this.title = config.title || '音频录制器';
        this.position = config.position || { x: 520, y: 100 };
        this.size = config.size || { width: 350, height: 500 };
        this.isVisible = false;
        this.isMinimized = false;

        // 音频相关
        this.isRecording = false;
        this.isPaused = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;

        // 录音设置
        this.recordingSettings = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000,
            sampleRate: 44100,
            channelCount: 1
        };

        // 可视化相关
        this.canvas = null;
        this.canvasContext = null;
        this.animationId = null;

        // 录音文件
        this.recordedFiles = [];
        this.currentRecordingStart = null;
        this.recordingDuration = 0;

        // UI元素
        this.windowElement = null;
        this.recordButton = null;
        this.pauseButton = null;
        this.stopButton = null;
        this.playButton = null;
        this.statusElement = null;
        this.timeElement = null;
        this.levelMeter = null;

        this.createWindow();
        this.bindEvents();
        this.initializeAudio();
    }

    // 创建窗口DOM结构
    createWindow() {
        this.windowElement = document.createElement('div');
        this.windowElement.className = 'audio-recorder-window';
        this.windowElement.id = this.id;
        this.windowElement.style.cssText = `
            position: fixed;
            left: ${this.position.x}px;
            top: ${this.position.y}px;
            width: ${this.size.width}px;
            height: ${this.size.height}px;
            z-index: 10000;
            display: none;
        `;

        this.windowElement.innerHTML = `
            <div class="audio-window-header">
                <div class="audio-window-title">
                    <i class="fas fa-microphone"></i>
                    <span class="title-text">${this.title}</span>
                </div>
                <div class="audio-window-controls">
                    <button class="audio-btn audio-btn-minimize" title="最小化">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="audio-btn audio-btn-close" title="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="audio-window-body">
                <!-- 音频可视化区域 -->
                <div class="audio-visualizer">
                    <canvas id="audioCanvas-${this.id}" width="300" height="120"></canvas>
                    <div class="audio-level-meter">
                        <div class="level-bar" id="levelMeter-${this.id}"></div>
                    </div>
                </div>
                
                <!-- 录音控制区域 -->
                <div class="audio-controls">
                    <div class="control-buttons">
                        <button class="audio-btn audio-btn-record" id="recordBtn-${this.id}" title="开始录音">
                            <i class="fas fa-circle"></i>
                        </button>
                        <button class="audio-btn audio-btn-pause" id="pauseBtn-${this.id}" title="暂停" disabled>
                            <i class="fas fa-pause"></i>
                        </button>
                        <button class="audio-btn audio-btn-stop" id="stopBtn-${this.id}" title="停止" disabled>
                            <i class="fas fa-stop"></i>
                        </button>
                        <button class="audio-btn audio-btn-play" id="playBtn-${this.id}" title="播放" disabled>
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    
                    <div class="recording-info">
                        <div class="recording-time" id="recordTime-${this.id}">00:00</div>
                        <div class="recording-status" id="audioStatus-${this.id}">就绪</div>
                    </div>
                </div>
                
                <!-- 音频设置 -->
                <div class="audio-settings">
                    <div class="setting-group">
                        <label>音频质量:</label>
                        <select id="qualitySelect-${this.id}" class="audio-select">
                            <option value="low">低质量 (64kbps)</option>
                            <option value="medium" selected>中等质量 (128kbps)</option>
                            <option value="high">高质量 (256kbps)</option>
                        </select>
                    </div>
                    
                    <div class="setting-group">
                        <label>自动处理:</label>
                        <div class="setting-options">
                            <label class="checkbox-label">
                                <input type="checkbox" id="autoSTT-${this.id}">
                                <span>语音转文本</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="autoSave-${this.id}" checked>
                                <span>自动保存</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 录音列表 -->
                <div class="recordings-list">
                    <div class="list-header">
                        <h4>录音文件</h4>
                        <button class="audio-btn audio-btn-small" id="clearAllBtn-${this.id}" title="清空所有">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="recordings-container" id="recordingsList-${this.id}">
                        <div class="no-recordings">
                            <i class="fas fa-microphone-slash"></i>
                            <p>暂无录音</p>
                        </div>
                    </div>
                </div>
                
                <!-- 连接控制 -->
                <div class="connection-controls">
                    <button class="audio-btn audio-btn-connect" id="connectOutputBtn-${this.id}" title="连接到输出节点">
                        <i class="fas fa-link"></i>
                        连接输出
                    </button>
                    <button class="audio-btn audio-btn-stream" id="streamBtn-${this.id}" title="开启流式传输">
                        <i class="fas fa-broadcast-tower"></i>
                        流式传输
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.windowElement);

        // 获取DOM元素引用
        this.canvas = document.getElementById(`audioCanvas-${this.id}`);
        this.canvasContext = this.canvas.getContext('2d');
        this.recordButton = document.getElementById(`recordBtn-${this.id}`);
        this.pauseButton = document.getElementById(`pauseBtn-${this.id}`);
        this.stopButton = document.getElementById(`stopBtn-${this.id}`);
        this.playButton = document.getElementById(`playBtn-${this.id}`);
        this.statusElement = document.getElementById(`audioStatus-${this.id}`);
        this.timeElement = document.getElementById(`recordTime-${this.id}`);
        this.levelMeter = document.getElementById(`levelMeter-${this.id}`);
        this.recordingsList = document.getElementById(`recordingsList-${this.id}`);
    }

    // 绑定事件
    bindEvents() {
        // 窗口拖拽
        this.makeDraggable();

        // 录音控制
        this.recordButton.addEventListener('click', () => this.startRecording());
        this.pauseButton.addEventListener('click', () => this.pauseRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.playButton.addEventListener('click', () => this.playLastRecording());

        // 设置控制
        document.getElementById(`qualitySelect-${this.id}`).addEventListener('change', (e) => {
            this.updateQuality(e.target.value);
        });

        // 清空录音
        document.getElementById(`clearAllBtn-${this.id}`).addEventListener('click', () => {
            this.clearAllRecordings();
        });

        // 连接控制
        document.getElementById(`connectOutputBtn-${this.id}`).addEventListener('click', () => {
            this.showConnectionDialog();
        });

        document.getElementById(`streamBtn-${this.id}`).addEventListener('click', () => {
            this.toggleStreaming();
        });

        // 窗口控制
        this.windowElement.querySelector('.audio-btn-minimize').addEventListener('click', () => this.minimize());
        this.windowElement.querySelector('.audio-btn-close').addEventListener('click', () => this.close());
    }

    // 使窗口可拖拽
    makeDraggable() {
        const header = this.windowElement.querySelector('.audio-window-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = this.position.x;
        let yOffset = this.position.y;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.audio-window-controls')) return;

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                this.windowElement.style.zIndex = '10001';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.windowElement.style.left = currentX + 'px';
                this.windowElement.style.top = currentY + 'px';
            }
        });

        document.addEventListener('mouseup', (e) => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            this.windowElement.style.zIndex = '10000';
        });
    }

    // 初始化音频
    async initializeAudio() {
        try {
            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('浏览器不支持音频录制');
            }

            // 检查MediaRecorder支持
            if (!window.MediaRecorder) {
                throw new Error('浏览器不支持MediaRecorder');
            }

            this.updateStatus('音频系统就绪');

        } catch (error) {
            console.error('音频初始化失败:', error);
            this.updateStatus('音频系统错误: ' + error.message);
        }
    }

    // 开始录音
    async startRecording() {
        try {
            if (this.isRecording) return;

            this.updateStatus('请求麦克风权限...');

            // 获取音频流
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.recordingSettings.sampleRate,
                    channelCount: this.recordingSettings.channelCount,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 创建音频上下文用于可视化
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.audioStream);
            this.microphone.connect(this.analyser);

            this.analyser.fftSize = 256;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            // 创建MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.audioStream, this.recordingSettings);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            // 开始录音
            this.mediaRecorder.start(100); // 每100ms收集一次数据
            this.isRecording = true;
            this.currentRecordingStart = Date.now();

            // 更新UI
            this.updateRecordingUI(true);
            this.startVisualization();
            this.startTimer();

            this.updateStatus('录音中...');

        } catch (error) {
            console.error('开始录音失败:', error);
            this.updateStatus('录音失败: ' + error.message);
            Utils.showNotification('无法开始录音: ' + error.message, 'error');
        }
    }

    // 暂停录音
    pauseRecording() {
        if (!this.isRecording || this.isPaused) return;

        this.mediaRecorder.pause();
        this.isPaused = true;

        this.pauseButton.innerHTML = '<i class="fas fa-play"></i>';
        this.pauseButton.title = '继续录音';
        this.updateStatus('录音已暂停');
    }

    // 继续录音
    resumeRecording() {
        if (!this.isRecording || !this.isPaused) return;

        this.mediaRecorder.resume();
        this.isPaused = false;

        this.pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        this.pauseButton.title = '暂停录音';
        this.updateStatus('录音中...');
    }

    // 停止录音
    stopRecording() {
        if (!this.isRecording) return;

        this.mediaRecorder.stop();
        this.isRecording = false;
        this.isPaused = false;

        // 停止音频流
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }

        // 停止音频上下文
        if (this.audioContext) {
            this.audioContext.close();
        }

        // 停止可视化
        this.stopVisualization();
        this.stopTimer();

        // 更新UI
        this.updateRecordingUI(false);
        this.updateStatus('处理录音...');
    }

    // 处理录音
    async processRecording() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: this.recordingSettings.mimeType });
            const duration = Date.now() - this.currentRecordingStart;

            const recording = {
                id: Utils.generateId('rec_'),
                blob: audioBlob,
                duration: duration,
                timestamp: this.currentRecordingStart,
                size: audioBlob.size,
                url: URL.createObjectURL(audioBlob)
            };

            this.recordedFiles.push(recording);
            this.addRecordingToList(recording);

            // 自动保存
            if (document.getElementById(`autoSave-${this.id}`).checked) {
                this.downloadRecording(recording);
            }

            // 自动语音转文本
            if (document.getElementById(`autoSTT-${this.id}`).checked) {
                await this.transcribeAudio(recording);
            }

            this.updateStatus('录音完成');
            this.playButton.disabled = false;

            Utils.showNotification('录音保存成功', 'success');

        } catch (error) {
            console.error('处理录音失败:', error);
            this.updateStatus('处理录音失败');
            Utils.showNotification('处理录音失败: ' + error.message, 'error');
        }
    }

    // 添加录音到列表
    addRecordingToList(recording) {
        // 移除"暂无录音"提示
        const noRecordings = this.recordingsList.querySelector('.no-recordings');
        if (noRecordings) {
            noRecordings.remove();
        }

        const recordingElement = document.createElement('div');
        recordingElement.className = 'recording-item';
        recordingElement.innerHTML = `
            <div class="recording-info">
                <div class="recording-name">录音 ${new Date(recording.timestamp).toLocaleTimeString()}</div>
                <div class="recording-details">
                    时长: ${this.formatDuration(recording.duration)} | 
                    大小: ${this.formatFileSize(recording.size)}
                </div>
            </div>
            <div class="recording-controls">
                <button class="audio-btn audio-btn-small" onclick="window.audioRecorderManager.playRecording('${recording.id}')" title="播放">
                    <i class="fas fa-play"></i>
                </button>
                <button class="audio-btn audio-btn-small" onclick="window.audioRecorderManager.downloadRecording('${recording.id}')" title="下载">
                    <i class="fas fa-download"></i>
                </button>
                <button class="audio-btn audio-btn-small" onclick="window.audioRecorderManager.deleteRecording('${recording.id}')" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        this.recordingsList.appendChild(recordingElement);
    }

    // 开始可视化
    startVisualization() {
        const draw = () => {
            if (!this.isRecording) return;

            this.animationId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(this.dataArray);

            // 清空画布
            this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // 绘制频谱
            const barWidth = this.canvas.width / this.dataArray.length;
            let x = 0;

            for (let i = 0; i < this.dataArray.length; i++) {
                const barHeight = (this.dataArray[i] / 255) * this.canvas.height;

                const r = barHeight + 25 * (i / this.dataArray.length);
                const g = 250 * (i / this.dataArray.length);
                const b = 50;

                this.canvasContext.fillStyle = `rgb(${r},${g},${b})`;
                this.canvasContext.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }

            // 更新电平显示
            const average = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;
            const level = (average / 255) * 100;
            this.levelMeter.style.width = level + '%';
        };

        draw();
    }

    // 停止可视化
    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // 清空画布
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.levelMeter.style.width = '0%';
    }

    // 开始计时器
    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.isRecording && !this.isPaused) {
                this.recordingDuration = Date.now() - this.currentRecordingStart;
                this.timeElement.textContent = this.formatDuration(this.recordingDuration);
            }
        }, 100);
    }

    // 停止计时器
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timeElement.textContent = '00:00';
        this.recordingDuration = 0;
    }

    // 更新录音UI状态
    updateRecordingUI(isRecording) {
        this.recordButton.disabled = isRecording;
        this.pauseButton.disabled = !isRecording;
        this.stopButton.disabled = !isRecording;

        if (isRecording) {
            this.recordButton.classList.add('recording');
        } else {
            this.recordButton.classList.remove('recording');
            this.pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
            this.pauseButton.title = '暂停';
        }
    }

    // 格式化时长
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 更新音频质量设置
    updateQuality(quality) {
        const qualitySettings = {
            low: { audioBitsPerSecond: 64000 },
            medium: { audioBitsPerSecond: 128000 },
            high: { audioBitsPerSecond: 256000 }
        };

        this.recordingSettings = {
            ...this.recordingSettings,
            ...qualitySettings[quality]
        };
    }

    // 显示/隐藏窗口
    show() {
        this.windowElement.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        this.windowElement.style.display = 'none';
        this.isVisible = false;
    }

    // 最小化
    minimize() {
        if (this.isMinimized) {
            this.windowElement.querySelector('.audio-window-body').style.display = 'block';
            this.windowElement.querySelector('.audio-btn-minimize i').className = 'fas fa-minus';
            this.isMinimized = false;
        } else {
            this.windowElement.querySelector('.audio-window-body').style.display = 'none';
            this.windowElement.querySelector('.audio-btn-minimize i').className = 'fas fa-plus';
            this.isMinimized = true;
        }
    }

    // 关闭窗口
    close() {
        if (this.isRecording) {
            this.stopRecording();
        }
        this.hide();
    }

    // 更新状态
    updateStatus(status) {
        this.statusElement.textContent = status;
    }

    // 播放最后录音
    playLastRecording() {
        if (this.recordedFiles.length > 0) {
            const lastRecording = this.recordedFiles[this.recordedFiles.length - 1];
            this.playRecording(lastRecording.id);
        }
    }

    // 播放录音
    playRecording(recordingId) {
        const recording = this.recordedFiles.find(r => r.id === recordingId);
        if (recording) {
            const audio = new Audio(recording.url);
            audio.play();
        }
    }

    // 下载录音
    downloadRecording(recordingId) {
        const recording = this.recordedFiles.find(r => r.id === recordingId);
        if (recording) {
            const link = document.createElement('a');
            link.href = recording.url;
            link.download = `recording_${new Date(recording.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
            link.click();
        }
    }

    // 删除录音
    deleteRecording(recordingId) {
        const index = this.recordedFiles.findIndex(r => r.id === recordingId);
        if (index !== -1) {
            const recording = this.recordedFiles[index];
            URL.revokeObjectURL(recording.url);
            this.recordedFiles.splice(index, 1);

            // 更新UI
            const recordingElement = this.recordingsList.querySelector(`[onclick*="${recordingId}"]`).closest('.recording-item');
            if (recordingElement) {
                recordingElement.remove();
            }

            // 如果没有录音了，显示提示
            if (this.recordedFiles.length === 0) {
                this.recordingsList.innerHTML = `
                    <div class="no-recordings">
                        <i class="fas fa-microphone-slash"></i>
                        <p>暂无录音</p>
                    </div>
                `;
                this.playButton.disabled = true;
            }
        }
    }

    // 清空所有录音
    clearAllRecordings() {
        if (this.recordedFiles.length === 0) return;

        if (confirm('确定要清空所有录音吗？')) {
            this.recordedFiles.forEach(recording => {
                URL.revokeObjectURL(recording.url);
            });

            this.recordedFiles = [];
            this.recordingsList.innerHTML = `
                <div class="no-recordings">
                    <i class="fas fa-microphone-slash"></i>
                    <p>暂无录音</p>
                </div>
            `;
            this.playButton.disabled = true;
        }
    }

    // 语音转文本
    async transcribeAudio(recording) {
        try {
            this.updateStatus('语音转文本中...');

            // 这里需要集成语音转文本API
            // 暂时模拟处理
            await new Promise(resolve => setTimeout(resolve, 1000));

            const transcription = '这是语音转文本的示例结果';

            // 可以将转录结果发送到对话窗口或其他节点
            Utils.showNotification('语音转文本完成', 'success');
            console.log('转录结果:', transcription);

        } catch (error) {
            console.error('语音转文本失败:', error);
            Utils.showNotification('语音转文本失败: ' + error.message, 'error');
        }
    }

    // 显示连接对话框
    showConnectionDialog() {
        Utils.showNotification('节点连接功能开发中...', 'info');
    }

    // 切换流式传输
    toggleStreaming() {
        Utils.showNotification('流式传输功能开发中...', 'info');
    }
}

// 音频录制窗口管理器
class AudioRecorderManager {
    constructor() {
        this.windows = new Map();
        this.activeWindowId = null;

        this.initializeUI();
    }

    // 初始化UI
    initializeUI() {
        this.addAudioRecorderButton();
    }

    // 添加音频录制按钮
    addAudioRecorderButton() {
        const toolbar = document.querySelector('.toolbar-right');
        if (toolbar) {
            const audioButton = document.createElement('button');
            audioButton.className = 'btn btn-danger';
            audioButton.id = 'openAudioBtn';
            audioButton.title = '打开音频录制器';
            audioButton.innerHTML = '<i class="fas fa-microphone"></i> 录音';

            audioButton.addEventListener('click', () => {
                this.createAudioRecorderWindow();
            });

            toolbar.insertBefore(audioButton, toolbar.querySelector('#openChatBtn').nextSibling);
        }
    }

    // 创建音频录制窗口
    createAudioRecorderWindow(config = {}) {
        const windowId = config.id || Utils.generateId('audio_');

        if (this.windows.has(windowId)) {
            this.windows.get(windowId).show();
            return this.windows.get(windowId);
        }

        const window = new AudioRecorderWindow({
            id: windowId,
            title: config.title || `音频录制器 ${this.windows.size + 1}`,
            position: config.position || this.getNextWindowPosition(),
            ...config
        });

        this.windows.set(windowId, window);
        this.activeWindowId = windowId;

        window.show();
        return window;
    }

    // 获取下一个窗口位置
    getNextWindowPosition() {
        const offset = this.windows.size * 30;
        return {
            x: 520 + offset,
            y: 100 + offset
        };
    }

    // 播放录音（供全局调用）
    playRecording(recordingId) {
        for (const window of this.windows.values()) {
            const recording = window.recordedFiles.find(r => r.id === recordingId);
            if (recording) {
                window.playRecording(recordingId);
                break;
            }
        }
    }

    // 下载录音（供全局调用）
    downloadRecording(recordingId) {
        for (const window of this.windows.values()) {
            const recording = window.recordedFiles.find(r => r.id === recordingId);
            if (recording) {
                window.downloadRecording(recordingId);
                break;
            }
        }
    }

    // 删除录音（供全局调用）
    deleteRecording(recordingId) {
        for (const window of this.windows.values()) {
            const recording = window.recordedFiles.find(r => r.id === recordingId);
            if (recording) {
                window.deleteRecording(recordingId);
                break;
            }
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.AudioRecorderWindow = AudioRecorderWindow;
    window.AudioRecorderManager = AudioRecorderManager;
}
