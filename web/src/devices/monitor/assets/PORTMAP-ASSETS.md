# Treehouse port-map runtime assets

> **ACTIVE manifest · 2026-08-04.** 포트 관련 이미지를 수정하기 전에 이 파일을 먼저 읽는다. 아래 영구 reference pack이 생성된 뒤에는 그 `spec.md`도 함께 읽는다.

✅ **영구 pack 생성 완료 (2026-08-04, Cindy 승인)** = `~/Treehouse-monitor/design-loop/refs/treehouse-portmap/` + 그 안의 `spec.md`. 외부 reference 2장은 그 pack으로 **이동**했다(해시 이동 전후 동일 확인 — 아래 표의 핀 그대로 유효). **역할 분담: 이 파일 = 런타임 정본·파생본 / pack의 `spec.md` = 근거 원본 + 각 reference에서 가져오면 안 되는 것.** 둘은 서로를 가리키므로 한쪽만 고치면 갈린다.

## 현재 정본

| 파일 | 상태 | 역할 | 크기 | SHA-256 |
|---|---|---|---|---|
| `xray-portmap-base.png` | **PRIMARY · 영 승인** | 줌인 포트맵의 형태·순서·아이콘·문구·재질 정본 | 4344×1448 | `a88436bd612512d3e4b182ed5a2f8ef53d701bda55ff1ad41a3f0b6033599f98` |
| `treehouse32-back-stand-xray.png` | **ACTIVE · DERIVED · MIRRORED** | 전체 후면 X-ray(풀스크린 전용). PRIMARY의 좌·우 패널 전체에서 파생 **후 좌우 반전** | 4096×3259 | `793dd568047b89902805c34498a43c79c784f41881f90990f0125dba7fdd407e` |
| `treehouse32-back.png` | **ACTIVE · DERIVED** | 표준 후면. PRIMARY의 좌·우 패널 전체에서 파생 | 2112×1738 | `4b1a478647c844067abb855f7825964983853a062e67c55d564c7a41b50e99ff` |

### ⚠️ 이 파일만 미러다 (2026-08-06, Cindy 확정)

`treehouse32-back-stand-xray.png`는 **풀스크린 X-ray 전용**이고, 화면을 통해 뒤를 보는 시점이라 **좌우 반전**이 정본이다 — 라벨(`HDMI 1` 등)이 거울글씨로 보이는 게 맞다. 나머지 두 파일(카드 포트맵·표준 후면)은 **비미러**이고 그대로 둔다. 근거 = `Claude HP/design-assets/component-specs.md` SPEC: xray #3.

- 이 파일을 새로 파생할 때는 **마지막 단계에 좌우 반전을 반드시 다시 적용**한다. 반전을 빼면 라벨이 읽히니 "개선된 것처럼" 보이지만 스펙 위반이고, 포트 좌우 순서가 코드 좌표와 어긋난다.
- 반전하면 `XrayCard.tsx`의 `XRAY_PORTS` 좌표(`left` = 중심 %)와 `PortGlyph`의 DP 키 방향도 함께 뒤집어야 한다.
- 2026-08-06 실측: 반전 전 렌더에서 오른쪽 포트 그룹이 이전 판보다 ~1% 왼쪽으로 이동해 있었다 → 좌표는 **매번 렌더 픽셀에서 다시 잰다**(개구부 = 이미지 세로 66.9~69.3% 구간, 라벨 띠와 분리해서 측정).

## 같은 폴더지만 정본이 아닌 것

| 파일 | 상태 | 취급 |
|---|---|---|
| `treehouse32-ports-strip.png` | **LEGACY · DO NOT DERIVE FROM** | 저해상도·깨진 label/icon이 남은 옛 strip. 코드 참조를 확인하기 전에는 삭제·rename하지 않지만, 새 이미지의 입력으로 쓰지 않는다. |
| `port-*-default.svg`, `port-*-hover.svg` | **INTERACTION LAYER** | Figma에서 온 개별 hover silhouette. raster 포트 외형·문구의 정본이 아니다. |

## 외부 reference — 속성별 역할

| 검증 속성 | 파일 | 반드시 유지할 값 | SHA-256 |
|---|---|---|---|
| 실제 포트 외형·접점·하우징 | `~/Treehouse-monitor/design-loop/refs/treehouse-portmap/hp-rear-ports-reference.png` | HP 후면 실물의 HDMI·DisplayPort·USB-C·USB-A·audio 구조. 특히 DisplayPort의 chamfer·gold contacts·L-key. ⚠️ **업무용 하드웨어 4종은 가져오지 말 것** — RJ45·Kensington 슬롯·C13/C14 전원 인렛·DP-out (이 렌더는 Series 7 업무용 실버기다. 파생 전 PRIMARY와 대조 필요 = `spec.md`) | `acd0530a64bfe1e6a73c375523b74d1053b10dbc98640371af4efa145d0e0f9c` |
| 고해상도 제작 방식 | `~/Treehouse-monitor/design-loop/refs/treehouse-portmap/xray-connector-craft-reference.png` | 포트를 평면 glyph가 아니라 recessed physical connector로 만든 방식. 밝은 배경·방향·전체 monitor 구성은 정본 아님 (알파 없는 RGB라 합성 입력으로 쓰면 흰 배경이 따라온다) | `003d3b3b33070c75e94728b19c088f075e89558aace25ccf9bab26db30dce4a6` |

⚠️ **이 두 파일에 `render-framing.py --fix`를 돌리지 말 것** — 픽셀이 바뀌어 위 SHA-256 핀과 `spec.md` 표가 동시에 깨진다. 프레이밍 규칙은 화면에 나가는 런타임 자산에만 적용된다.

## 실패 버전의 의미

- `...hires-mirrored-v3.png` / `...hires-crisp-mirrored-v6.png`: port와 label이 생성 과정에서 픽셀화된 실패 예시.
- `...vector-mirrored-v7.png`: 선명하지만 실사 connector가 vector glyph로 평면화된 실패 예시.
- 2026-08-04 반려본: 기존 저해상도 panel을 둔 채 DisplayPort만 사각 patch. 단일 port 수정이 전체 panel 정합을 보장하지 못한다는 실패 예시.

## 시스템 리뷰 요약

문제는 ImageGen 품질 하나가 아니라 **reference lineage 부재**였다. 실물 reference는 `Claude HP/inbox`, 제작 예시는 `Treehouse-monitor/_archive`, PRIMARY와 LEGACY는 이 flat `assets/` 폴더에 흩어져 있었고 파일별 역할표가 없었다. 다음 세션은 근거 대신 filename과 최근 대화에서 관계를 추정하게 됐다.

이 asset family는 **Invisible AI Zone 2**로 운용한다.

- PRIMARY가 승인돼 있고 크기만 다른 derived를 만드는 결정적 작업은 AI가 바로 실행한다.
- reference끼리 형태·순서·문구가 충돌하거나 새 creative direction이 필요하면 영에게 충돌 한 가지만 확인한다.
- reference 관계가 비어 있으면 생성·overwrite보다 이 manifest 갱신이 먼저다.

## 변경 규칙

1. DisplayPort 같은 단일 포트 patch로 전체 후면을 고치지 않는다. PRIMARY의 **좌·우 패널 전체**를 파생한다.
2. `필수 요소 → 개수 → 순서 → icon/label → port 외형 → 사각 경계` 순으로 확대 대조한다.
3. HP 실물과 PRIMARY가 충돌하면 조용히 섞지 않고 한 가지 충돌만 영에게 묻는다.
4. 새 ImageGen 호출 전에 기존 PRIMARY와 reference pack으로 결정적 합성이 가능한지 먼저 확인한다.
5. CURRENT worktree가 바뀌면 `Claude HP/progress.md`의 CURRENT 행을 따라가며, 이 파일을 새 runtime assets 폴더로 함께 옮긴다.

## ✅ Machine enforcement — 층 D 설치 완료 (2026-08-04, Cindy 승인)

권고대로 **새 훅을 만들지 않고** 기존 `Claude HP/.claude/hooks/asset-orientation-guard.py`에 **층 D**로 얹었다(층 C 선례와 동일 방식). 검사 4개:

| 검사 | 무엇을 막나 | 강도 |
|---|---|---|
| **D-1** | `treehouse32-ports-strip`(LEGACY)을 새 포트맵 이미지의 **입력**으로 쓰는 것 | 하드 블록 |
| **D-2** | 근거 pack(`design-loop/refs/treehouse-portmap/`)의 이미지를 덮어쓰거나 `--fix`로 정규화 = **SHA-256 핀 파괴** | 하드 블록 |
| **D-3** | 포트맵 자산 쓰기 세션 첫 1회 차단 + 위 변경 규칙 + **업무용 하드웨어 4종 배제 목록** 주입 | ack 게이트 |
| **D-4** | 근거 2장의 해시가 `spec.md` 핀과 어긋남 (근거가 바뀌면 그 위 파생 판단 전부 무효) | PostToolUse 알림 |

- **기대 해시는 훅에 복제하지 않는다** — `spec.md` 표에서 파싱한다(단일 소스). pack이나 spec이 없으면 D-2·D-4는 조용히 통과 = fail-open.
- 검증: 12케이스 canary 전부 통과(`Claude HP/.claude/hooks/fixtures/test-asset-orientation-layer-d.py`, A층 회귀 + 오탐 회귀 3건 포함) + `~/Shared Assets/guard_canary.py` FIXTURES에 D-1·D-2 등재, HP 스코프 **FAIL 0**.
- **상태 = SCRIPT TESTED** (실세션 발동 기록이 쌓이면 APP RUNTIME VERIFIED).
- ⚠️ **정직한 한계 2개**: ① "파생본이 업무용 포트를 물려받았나"는 **이미지 의미 판단이라 기계가 못 본다** — D-3이 목록을 눈앞에 들이미는 것까지가 레일의 몫이고 대조는 사람·모델이 한다 ② **D-4는 fixture로 증명 불가** — 정상 상태에선 allow가 정답이라 deny를 만들려면 근거를 실제로 오염시켜야 한다(감사가 자산을 망칠 수 없음).
