import cover from "../assets/rulebook/cover.webp?inline";

/** A separate modal keeps the active run and its persistent stage untouched. */
const art = import.meta.glob<string>("../assets/rulebook/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

function figure(name: string, caption: string): string {
  const illustration = art[`../assets/rulebook/${name}.svg`] ?? "";
  return `<figure class="rulebook-figure"><div class="rulebook-art" aria-hidden="true">${illustration}</div><figcaption>${caption}</figcaption></figure>`;
}

export function rulebookButton(): string {
  return `<button type="button" class="rulebook-button" data-rulebook-open aria-label="게임 롤북 열기" aria-haspopup="dialog">롤북</button>`;
}

function rulebookContent(): string {
  return `<header class="rulebook-header"><div><span class="rulebook-kicker">포포와 함께 떠나는 음악 여행</span><h2 id="rulebook-title" tabindex="-1">음정 정거장 롤북</h2></div><button type="button" class="rulebook-close" data-rulebook-close aria-label="롤북 닫기">✕</button></header>
  <div class="rulebook-body">
    <div class="rulebook-cover"><img class="rulebook-cover-art" src="${cover}" alt=""><span>음악을 눈으로 보고, 귀로 듣고, 기차로 움직여요</span><strong>기차 여행 안내서</strong><p>승차권을 읽고 역을 세며 두 음 사이의 거리를 익혀 보세요.</p></div>
    <nav class="rulebook-nav" aria-label="롤북 목차"><a href="#rb-start">시작하기</a><a href="#rb-stations">역과 음정</a><a href="#rb-tickets">승차권</a><a href="#rb-help">도움과 채점</a><a href="#rb-routes">노선과 별</a><a href="#rb-settings">설정과 저장</a></nav>
    <section id="rb-start" class="rulebook-section"><span class="rulebook-index">01 · 여행 준비</span><h3>어떤 게임인가요?</h3>
      ${figure("overview", "포포와 함께 승차권을 완성하며 종착역까지 여행해요.")}
      <p>음정 정거장은 기차를 움직이며 <strong>두 음의 거리인 음정</strong>을 배우는 음악 게임이에요. 노선을 고르면 여러 장의 승차권이 차례로 나옵니다. 각 승차권을 완성하고 마지막 종착역까지 가 보세요.</p>
      <ol><li>처음이라면 제목 화면의 <strong>포포와 운전 연습</strong>을 해 보세요.</li><li><strong>출발하기</strong>에서 노선을 선택해요.</li><li>승차권을 읽고 기차를 움직이거나 두 음을 듣고 답을 골라요.</li><li>도착 후 다음 승차권을 열어 마지막까지 완주해요.</li></ol>
      ${figure("controls", "무대를 밀거나 화살표 버튼을 눌러 기차를 움직여요.")}
      <p>화면을 좌우로 밀거나 ◀·▶ 버튼을 누르면 기차가 움직입니다. 원하는 역에서 <strong>도착!</strong>을 누르세요. 컴퓨터에서는 ←·→ 키와 Enter 키를 사용할 수 있고, Esc 키로 잠시 멈출 수 있어요.</p>
    </section>
    <section id="rb-stations" class="rulebook-section"><span class="rulebook-index">02 · 역 읽기</span><h3>도수와 반음은 어떻게 다를까요?</h3>
      ${figure("degree", "도수는 출발역을 ①로 포함하여 흰 역의 이름을 세어요.")}
      <p><strong>도수</strong>는 출발 음과 도착 음을 포함해 음 이름을 몇 개 거치는지 세는 수예요. 예를 들어 도 → 레 → 미는 도를 ①로 세어 <strong>3도</strong>입니다. 입문 노선의 도수 승차권은 흰 역만 따라 움직여요.</p>
      ${figure("semitone", "반음은 역의 개수가 아니라 역 사이를 이동한 칸 수예요.")}
      <p><strong>반음</strong>은 한 역에서 바로 옆 역까지의 거리예요. 흰 역과 검은 터널을 포함해 이동한 <em>구간</em>을 세며 출발점은 0칸으로 시작합니다. 도 → 도♯는 반음 1칸, 도 → 레는 반음 2칸이에요.</p>
      <p>같은 역에서도 음 이름이 다를 수 있어요. 예를 들어 도 → 레♯와 도 → 미♭는 같은 반음 거리지만 글자 수가 달라 각각 증2도와 단3도라고 불러요.</p>
    </section>
    <section id="rb-tickets" class="rulebook-section"><span class="rulebook-index">03 · 승차권</span><h3>승차권 종류별로 운전해요</h3>
      <h4>도수 승차권</h4><p>출발역을 ①로 포함해 흰 역의 이름을 세고, 표시된 방향과 도수에 맞는 역에서 도착하세요. 예를 들어 도에서 위로 3도라면 도·레·미이므로 미 역에 도착합니다.</p>
      <h4>반음 연습권</h4><p>기본 노선 첫 두 번의 운행에서는 본 승차권 6장 전에 반음과 온음을 세는 준비 연습 2장이 나와요. 준비 연습은 숙련도에 기록되지 않습니다.</p>
      ${figure("read", "깃발이 있는 역으로 이동한 뒤 음정 이름을 골라요.")}
      <h4>읽기 승차권</h4><p>목적지 깃발까지 기차를 운전하고 도착한 다음, 출발음과 도착음 사이에 맞는 음정 이름을 보기에서 선택해요. 역 이름의 수와 반음 수를 함께 살펴보세요.</p>
      ${figure("make", "승차권에 적힌 음정과 방향에 맞는 목적지를 찾아가요.")}
      <h4>만들기 승차권</h4><p>승차권에 적힌 음정 이름과 방향을 보고 직접 맞는 역을 찾아 도착하세요. ♯와 ♭ 이름표가 붙은 음도 함께 살펴봅니다.</p>
      ${figure("ear", "두 음을 듣고 방향과 음정 이름을 선택해요.")}
      <h4>소리 승차권</h4><p>두 음을 듣고 음정 이름을 선택해요. 1단계에서 음이 차례로 나올 때는 두 번째 음의 방향을 먼저 묻기도 해요. <strong>다시 듣기</strong>로 반복해서 들을 수 있고, 어려우면 <strong>귀로 찾아가기</strong>로 기차를 움직이며 확인할 수 있어요.</p>
    </section>
    <section id="rb-help" class="rulebook-section"><span class="rulebook-index">04 · 도움이 필요할 때</span><h3>실수해도 다시 도전할 수 있어요</h3>
      ${figure("assist", "세기 도움, 음정 자, 다시 듣기 등으로 천천히 연습해요.")}
      <p><strong>세기 도움</strong>을 켜면 지나온 글자 수와 반음 수를 화면에서 확인할 수 있어요. 일시정지 메뉴의 <strong>이번 승차권 음정 자</strong>도 참고할 수 있습니다. 틀린 경우 다시 운전하거나 안내를 보고 고칠 수 있어요.</p>
      <p>정답을 맞히면 음정이 어떻게 만들어졌는지 보여 줍니다. <strong>●</strong>는 오답이나 음정 자·귀로 찾아가기 없이 혼자 도착한 승차권, <strong>◐</strong>는 실수를 고쳤거나 음정 자·귀로 찾아가기를 사용해 도착한 승차권이에요. 세기 도움을 켜는 것 자체가 ◐를 뜻하지는 않아요.</p>
    </section>
    <section id="rb-routes" class="rulebook-section"><span class="rulebook-index">05 · 노선 안내</span><h3>다섯 노선과 완주 보상</h3>
      ${figure("progress", "각 노선의 승차권을 완성하고 별과 스탬프를 모아요.")}
      <ul><li><strong>입문 노선 · 7장:</strong> 흰 역의 이름을 세어 도수를 익혀요.</li><li><strong>기본 노선 · 6장:</strong> 도수와 반음 수를 함께 살펴 음정을 읽어요.</li><li><strong>완주 노선 · 12장:</strong> 주어진 음정을 직접 만들어요.</li><li><strong>청음 노선 · 6장:</strong> 두 음을 듣고 음정을 찾아요. 기본 노선에서 별 1개를 얻으면 열립니다.</li><li><strong>통합 노선 · 9장:</strong> 읽기·만들기·듣기를 함께 연습해요. 기본과 청음 노선에서 각각 별 1개를 얻으면 열립니다.</li></ul>
      <p>청음은 익힌 정도에 따라 3종, 7종, 12종의 음정으로 넓어져요. 한 운행을 마치면 적어도 별 1개를 받고, <strong>혼자 도착이 80% 이상이면 별 2개</strong>를 받아요. 모든 승차권을 혼자 도착하고 운행 내내 세기 도움을 끄면 별 3개예요.</p>
      <p>결과 화면에서 이번 여행의 도착 수와 스탬프를 보고 <strong>이번 여행 선율 듣기</strong>로 지나온 음들을 다시 들을 수 있어요.</p>
    </section>
    <section id="rb-settings" class="rulebook-section"><span class="rulebook-index">06 · 여행 도구</span><h3>음정 수첩과 설정</h3>
      ${figure("notebook", "음정 수첩에서 반음 수, 음정 이름과 학습 기록을 살펴봐요.")}
      <p>상단의 <strong>음정 수첩</strong>에서 반음 수별 음정 이름과 읽기·만들기·듣기 기록을 확인하고 예시 음정을 들어 볼 수 있어요.</p>
      <p><strong>설정</strong>에서 소리 크기, 음소거, 진동, 세기 도움 기본값과 화면 움직임을 바꿀 수 있어요. 소리가 들리지 않으면 기기의 미디어 음량과 무음 설정을 확인한 뒤 소리 켜기 또는 소리 확인하기를 눌러 보세요.</p>
      <p>진행 상황은 사용 중인 <strong>이 브라우저</strong>에 저장됩니다. 잠시 멈추거나 다시 열었을 때 하던 여행을 이어갈 수 있어요. 설정에서 저장 데이터를 초기화하면 기록이 지워집니다. 오프라인 준비가 완료된 뒤에는 연결이 끊겨도 게임을 이용할 수 있어요.</p>
      <div class="rulebook-finish"><strong>준비됐나요?</strong><span>창을 닫고 포포와 함께 출발해요!</span><button type="button" data-rulebook-close>게임으로 돌아가기</button></div>
    </section>
  </div>`;
}

export function installRulebook(root: HTMLElement): void {
  const dialog = document.createElement("dialog");
  dialog.className = "rulebook";
  dialog.setAttribute("aria-labelledby", "rulebook-title");
  dialog.innerHTML = rulebookContent();
  root.append(dialog);
  let opener: HTMLElement | null = null;
  root.addEventListener("click", (event) => {
    const target = event.target as Element;
    const trigger = target.closest<HTMLElement>("[data-rulebook-open]");
    if (trigger) {
      if (dialog.open) return;
      opener = trigger;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("#rulebook-title")?.focus({ preventScroll: true });
    } else if (target.closest("[data-rulebook-close]")) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  // The game listens for arrow and Enter keys on window; do not steer it behind the modal.
  window.addEventListener(
    "keydown",
    (event) => {
      if (dialog.open && ["ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(event.key))
        event.stopImmediatePropagation();
    },
    true,
  );
}
