(function(){
	'use strict';

	console.log("Netflix 자막 모니터링 시작...")

	let lastSubtitle = '';
	let observer = null;
	let lastUrl = location.href;
	let lastRomaji = '';

	function findSubtitleContainer() {
		return document.querySelector(".player-timedtext-text-container");
	}

	function isWatchPage() {
		return location.pathname.startsWith('/watch');
	}

	function addCustomButton() {
	    const subtitleBtn = document.querySelector('[data-uia="control-audio-subtitle"]');
    	const gpipej = subtitleBtn?.closest('.default-ltr-iqcdef-cache-gpipej');
		const btnColor = 'rgb(255, 255, 255)';

    	if (!subtitleBtn || !gpipej || document.querySelector('#jamak-button-host')) {
    	    return;
    	}
	
    	
		const customElement = document.createElement('div');
    	customElement.id = 'jamak-button-host';
		customElement.style.boxSizing = 'border-box';
    	customElement.style.border = '2px solid white';
		customElement.style.borderRadius = '1.2rem';
    	customElement.style.minWidth = '4.4rem';
    	customElement.style.height = '4.4rem';

		gpipej.insertBefore(customElement, gpipej.firstChild)
    	gpipej.style.border = `2px solid ${btnColor}`;
	}

	function watchForControlBar() {
	    const controlBarObserver = new MutationObserver((mutations) => {
	        // 컨트롤바가 있고, 우리 버튼이 없으면 추가
	        const controlBar = document.querySelector('[data-uia="controls-standard"]');
	        const myButton = document.querySelector('#jamak-button-host');
		
	        if (controlBar && !myButton) {
	            addCustomButton();
	        }
	    });

	    controlBarObserver.observe(document.body, {
	        childList: true,
	        subtree: true
	    });

	    // 이미 있으면 바로 추가
	    addCustomButton();
	}

	function addCustomSubtitleContainer() {
    	if (document.querySelector('#custom-subtitle-host')) return;

    	const originalContainer = findSubtitleContainer();
    	if (!originalContainer) return;

		const parent = originalContainer.parentElement;
		if (!parent) return;

    	const originalStyle = getComputedStyle(originalContainer);
		
    	const host = document.createElement('div');
    	host.id = 'custom-subtitle-host';

    	host.style.position = originalStyle.position;
		host.style.left = '50%';
		host.style.transform = 'translateX(-50%)';
    	host.style.whiteSpace = originalStyle.whiteSpace;
    	host.style.textAlign = originalStyle.textAlign;
    	host.style.display = originalStyle.display;
    	host.style.direction = originalStyle.direction;
    	host.style.bottom = '10%';
		host.style.zIndex = '9999';
		
		const originalSpan = originalContainer.querySelector('span span');
		const spanStyle = originalSpan ? getComputedStyle(originalSpan) : null;

    	const shadow = host.attachShadow({ mode: 'open' });
		
    	shadow.innerHTML = `
    	    <style>
    	        .custom-subtitle {
					background: rgba(0, 100, 200, 0.7);
                	border-radius: 8px;
                	padding: 8px 16px;
                	text-align: center;
                	box-sizing: border-box;
                	display: inline-block;
		
                	font-size: ${spanStyle?.fontSize || '28px'};
                	line-height: ${spanStyle?.lineHeight || 'normal'};
                	font-weight: ${spanStyle?.fontWeight || 'bolder'};
                	color: ${spanStyle?.color || '#ffffff'};
                	text-shadow: ${spanStyle?.textShadow || '#000000 0px 0px 7px'};
                	font-family: ${spanStyle?.fontFamily || 'Netflix Sans, Helvetica Neue, Helvetica, Arial, sans-serif'};
    	        }
    	    </style>
    	    <div class="custom-subtitle">
    	        ${lastRomaji}
    	    </div>
    	`;
		
    	parent.appendChild(host);
    	console.log('✅ 커스텀 자막 컨테이너 추가 완료');
	}	

	function extractSubtitleText(container) {
		if (!container) return '';

		const spans = container.querySelectorAll(':scope > span');
		const text = Array.from(spans)
			.map(span => span.innerText)
			.join(' ')
			.replace(/\n/g, ' ')
        	.replace(/\s+/g, ' ')
			.trim();
		
		return text;
	}

	function applySubtitleStyle(container) {
		if(!container) {
			return;
		}
		container.style.setProperty('background-color', 'rgba(182, 136, 12, 0.7)', 'important'); 
		container.style.setProperty('border-radius', '8px', 'important');  // px -> rem
		container.style.setProperty('padding', '8px 12px', 'important');

		container.style.setProperty('bottom', '20%', 'important');
		container.style.setProperty('left', '50%', 'important');
		container.style.setProperty('transform', 'translateX(-50%)', 'important');

		container.querySelectorAll('br').forEach(br => {
			br.replaceWith(' ');
		});
	}

	async function convertToRomaji(text) {
		try {
			const response = await fetch('http://192.168.1.6:8000/pronounce', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ sentence:text })
			});

			const data = await response.json();
			return data.romaji || null;

		} catch(error) {
			console.error('로마자 변환 실패:', error);
        	return null;
		}
	}

	function updateCustomSubtitle(text) {
	    lastRomaji = text;
		
	    const host = document.querySelector('#custom-subtitle-host');
	    if (!host || !host.shadowRoot) return;
		
	    const subtitleDiv = host.shadowRoot.querySelector('.custom-subtitle');
	    if (subtitleDiv) {
	        subtitleDiv.textContent = text;
	    }
	}

	async function handleSubtitleChange() {
		const container = findSubtitleContainer();
		const currentSubtitle = extractSubtitleText(container);

		if(container) {
			applySubtitleStyle(container);
		}

		if (currentSubtitle && currentSubtitle !== lastSubtitle) {
			console.log('🎬 자막:', currentSubtitle);
			lastSubtitle = currentSubtitle;

			const romaji = await convertToRomaji(currentSubtitle);
			if(romaji) {
				updateCustomSubtitle(romaji);
			}
		}
		else if (!currentSubtitle && lastSubtitle) {
			lastSubtitle = '';
			updateCustomSubtitle('');
		}
	}

	function setupVideoListener() {
		const video = document.querySelector('video');

		if(!video) {
			console.log('비디오 요소를 찾지 못했습니다. 3초 후 재시도...');
			setTimeout(setupVideoListener, 3000);
			return;
		}

		console.log('🎥 비디오 이벤트 리스너 등록');

		video.addEventListener('play', ()=>{
			console.log('▶️ 재생 시작 - observer 재설정');

			if(observer) {
				observer.disconnect();
				observer = null;
			}

			setTimeout(setupObserver, 3000);
		});
	}

	function watchForPlaybackRestart() {
	    const restartObserver = new MutationObserver(() => {
	        const restartBtn = document.querySelector('.watch-video--playback-restart button');
		
	        if (restartBtn && !restartBtn.hasAttribute('data-listener-added')) {
	            // ⭐ 중복 방지용 표시
	            restartBtn.setAttribute('data-listener-added', 'true');
			
	            restartBtn.addEventListener('click', () => {
	                console.log('🔄 재생 재시작 감지! 재초기화...');
				
	                // 기존 observer 정리
	                if (observer) {
	                    observer.disconnect();
	                    observer = null;
	                }
				
	                // 기존 커스텀 요소 제거
	                document.querySelector('#custom-subtitle-host')?.remove();
	                document.querySelector('#jamak-button-host')?.remove();
				
	                // 자막 상태 초기화
	                lastSubtitle = '';
				
	                // 약간의 딜레이 후 재초기화
	                setTimeout(() => {
	                    setupObserver();
	                    setupVideoListener();
	                    watchForControlBar();
	                }, 2000);
	            });
			
	            console.log('✅ 재생 재시작 버튼 감지, 리스너 추가됨');
	        }
	    });
	
	    restartObserver.observe(document.body, {
	        childList: true,
	        subtree: true
	    });
	}

	function setupObserver() {

		if(!isWatchPage()){
			console.log('📺 영상 페이지가 아닙니다. 대기 중...');
			return;
		}

		if (observer) {
    		return;
    	}
		const container = findSubtitleContainer();

		if (!container) {
			console.log('자막 컨테이너를 찾지 못했습니다. (영상 재생 필요)');
			setTimeout(setupObserver, 100);
			return;
		}
		console.log('✅ 자막 컨테이너 발견! 모니터링 중...');

		addCustomSubtitleContainer();

		if (observer) {
			observer.disconnect();
			observer = null;
		}

		const parentContainer = container.parentElement;

		if (!parentContainer) {
			console.error('부모 컨테이너를 찾을 수 없습니다.');
			return;
		}
		
		observer = new MutationObserver(() => {
			handleSubtitleChange();
		});

		observer.observe(parentContainer, {
			childList: true,
			subtree: true,
			characterData: true
		});

		handleSubtitleChange();
	}

	function watchForCustomSubtitle() {
	    const subtitleObserver = new MutationObserver(() => {
	        const original = findSubtitleContainer();
	        const custom = document.querySelector('#custom-subtitle-host');
		
	        // 기존 자막은 있는데 커스텀이 없으면 생성
	        if (original && !custom) {
	            addCustomSubtitleContainer();
	        }
	    });
	
	    subtitleObserver.observe(document.body, {
	        childList: true,
	        subtree: true
	    });
	}

	setupObserver();
	setupVideoListener();
	watchForControlBar();
	watchForCustomSubtitle();
	watchForPlaybackRestart();


	const urlObserver = new MutationObserver(() => {
		const currentUrl = location.href;

		if(currentUrl !== lastUrl) {
			lastUrl = currentUrl;

			console.log('🔄 페이지 변경 감지, 재초기화...');

			lastSubtitle = '';

			if(observer) {
				observer.disconnect();
				observer = null;
			}

			setTimeout(setupObserver, 2000);
		}
	});

	urlObserver.observe(document.body, {
		childList: true,
		subtree: true
	});
})();