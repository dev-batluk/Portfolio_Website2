import { useEffect, useState } from 'react';
import { FileCheck2, ShieldCheck, X } from 'lucide-react';
import { OpticalButton } from './OpticalPrimitives';

export type LegalDocId = 'privacy' | 'consent' | 'terms' | 'cookies';

interface LegalModalProps {
  docId: LegalDocId | null;
  onSelectDoc: (docId: LegalDocId) => void;
  onClose: () => void;
}

const DOC_TABS: Array<{ id: LegalDocId; shortTitle: string; title: string }> = [
  {
    id: 'privacy',
    shortTitle: 'Политика (152-ФЗ)',
    title: 'Политика конфиденциальности и обработки персональных данных',
  },
  {
    id: 'consent',
    shortTitle: 'Согласие ПДн',
    title: 'Согласие на обработку персональных данных',
  },
  {
    id: 'terms',
    shortTitle: 'Соглашение',
    title: 'Пользовательское соглашение и условия демо-заказа',
  },
  {
    id: 'cookies',
    shortTitle: 'Cookie',
    title: 'Политика использования файлов Cookie и локального хранилища',
  },
];

export function LegalModal({ docId, onSelectDoc, onClose }: LegalModalProps) {
  const [isMounted, setIsMounted] = useState(Boolean(docId));
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (docId) {
      setIsMounted(true);
      if (prefersReduced) {
        setIsVisible(true);
        return;
      }
      setIsVisible(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setIsVisible(false);
    if (prefersReduced) {
      setIsMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setIsMounted(false), 280);
    return () => window.clearTimeout(timer);
  }, [docId]);

  useEffect(() => {
    if (!docId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [docId, onClose]);

  if (!isMounted || !docId) return null;

  const activeMeta = DOC_TABS.find((t) => t.id === docId) ?? DOC_TABS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[85] flex items-end md:items-center justify-center bg-black/50 p-0 md:p-6 backdrop-blur-md transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`relative flex w-full max-w-[780px] max-h-[90svh] flex-col overflow-hidden rounded-t-2xl md:rounded-2xl bg-[#F6F6F4]/95 backdrop-blur-xl border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_34px_96px_rgba(0,0,0,0.34)] transition-all duration-320 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible
            ? 'translate-y-0 opacity-100 md:scale-100'
            : 'translate-y-8 opacity-0 md:translate-y-0 md:scale-[0.96]'
        }`}
      >
        {/* Top Header */}
        <div className="border-b border-black/10 px-5 sm:px-7 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4 mb-3.5">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0B0B0B]/50 mb-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Юридическая информация · 152-ФЗ РФ</span>
              </p>
              <h2
                id="legal-modal-title"
                className="font-display text-base sm:text-lg font-black uppercase tracking-[-0.02em] text-[#0B0B0B]"
              >
                {activeMeta.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть документ"
              className="acrylic-light-strong inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0B0B0B] transition-all duration-200 hover:bg-[#0B0B0B] hover:text-[#F6F6F4] active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {DOC_TABS.map((tab) => {
              const active = tab.id === docId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectDoc(tab.id)}
                  className={`h-8 shrink-0 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    active
                      ? 'border-[#0B0B0B] bg-[#0B0B0B] text-[#F6F6F4]'
                      : 'border-black/12 bg-white/75 text-[#0B0B0B]/68 hover:text-[#0B0B0B]'
                  }`}
                >
                  {tab.shortTitle}
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Body */}
        <div
          data-lenis-prevent="true"
          className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-4 text-xs sm:text-[13px] leading-[1.7] text-[#0B0B0B]/80"
        >
          {docId === 'privacy' && (
            <>
              <div className="acrylic-light rounded-2xl p-4 flex items-start gap-3">
                <FileCheck2 className="h-4 w-4 shrink-0 mt-0.5 text-[#0B0B0B]" />
                <p className="text-xs text-[#0B0B0B]/75">
                  Редакция от 26 ноября 2026 г. Разработана в соответствии с Федеральным законом РФ
                  от 27.07.2006 № 152-ФЗ «О персональных данных».
                </p>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  1. Оператор и статус проекта
                </h3>
                <p>
                  Оператором персональных данных, обрабатываемых на сайте бренда{' '}
                  <strong>NEVERMIND Archive</strong> (портфолио-демонстрация коммерческого
                  интернет-магазина студии <strong>/dev/batluk</strong>), является владелец сервиса
                  (далее — «Оператор»).
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  2. Состав обрабатываемых данных и цели
                </h3>
                <p>
                  При оформлении заказа Пользователь предоставляет: имя и фамилию, номер телефона,
                  адрес электронной почты, опциональный никнейм Telegram и адрес доставки (либо
                  пункт СДЭК). Данные обрабатываются исключительно для оформления, комплектации,
                  передачи в доставку и информирования о статусе заказа.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  3. Сроки хранения и автоудаление (30 дней)
                </h3>
                <p>
                  В соответствии с принципом минимизации данных (ст. 5 ФЗ № 152-ФЗ) все записи
                  заказов в базе данных сервиса, перешедшие в статус{' '}
                  <strong>«Выполнен»</strong>, <strong>автоматически и безвозвратно удаляются через
                  30 календарных дней</strong> после даты завершения заказа. Отменённые и текущие
                  заказы хранятся не дольше срока урегулирования вопросов по доставке или до отзыва
                  согласия субъектом ПДн.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  4. Защита персональных данных
                </h3>
                <p>
                  Оператор принимает необходимые правовые, организационные и технические меры для
                  защиты персональных данных от неправомерного доступа, уничтожения, изменения,
                  блокирования, копирования и распространения. Доступ к данным ограничен и
                  предоставляется только уполномоченным лицам после авторизации.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  5. Права субъекта персональных данных
                </h3>
                <p>
                  Пользователь вправе запросить уточнение, блокирование или досрочное удаление своих
                  персональных данных, направив обращение через контакты Оператора в Telegram (
                  <strong>@devbatluk</strong>).
                </p>
              </section>
            </>
          )}

          {docId === 'consent' && (
            <>
              <section className="space-y-2">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  Текст согласия на обработку персональных данных (ст. 9 ФЗ № 152-ФЗ)
                </h3>
                <p>
                  Проставляя отметку (чекбокс) в форме оформления заказа на сайте NEVERMIND Archive и
                  нажимая кнопку «Перейти к оплате», я свободно, своей волей и в своём интересе
                  выражаю конкретное, предметное, информированное и сознательное согласие Оператору на
                  обработку моих персональных данных:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Фамилия и имя;</li>
                  <li>Контактный номер телефона;</li>
                  <li>Адрес электронной почты (email);</li>
                  <li>Никнейм в мессенджере Telegram (при добровольном указании);</li>
                  <li>Адрес доставки либо пункт выдачи заказов (ПВЗ СДЭК).</li>
                </ul>
                <p>
                  <strong>Действия с данными:</strong> сбор, запись, систематизация, накопление,
                  хранение в изолированной серверной базе данных, уточнение, использование для
                  связи и доставки, обезличивание и автоматическое удаление по истечении 30 дней
                  после выполнения заказа.
                </p>
                <p>
                  <strong>Срок действия:</strong> до достижения целей обработки (автоудаление через
                  30 дней после статуса «Выполнен») либо до момента отзыва согласия через обращение в
                  поддержку (`@devbatluk`). Факт и точная дата-время принятия согласия фиксируются на
                  сервере в карточке заказа.
                </p>
              </section>
            </>
          )}

          {docId === 'terms' && (
            <>
              <section className="space-y-2">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  1. Назначение витрины и режим портфолио-демо
                </h3>
                <p>
                  Сайт NEVERMIND Archive является демонстрационным образцом готового коммерческого
                  продукта электронной торговли (витрина + серверная БД + админ-панель). На этапе
                  портфолио онлайн-списание денежных средств отключено: шаг оплаты содержит
                  информационную заглушку, иллюстрирующую точку подключения реального эквайринга
                  (СБП, банковские карты, ЮKassa, CloudPayments, Т-Касса, Stripe).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  2. Расчёт стоимости и наличие
                </h3>
                <p>
                  Итоговая стоимость товаров, скидки по промокоду и тарифы доставки рассчитываются и
                  проверяются исключительно на сервере в момент оформления заказа. Остатки размеров
                  резервируются транзакционно и возвращаются на склад автоматически при отмене заказа
                  менеджером.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  3. Интеллектуальная собственность
                </h3>
                <p>
                  Дизайн-система, код, визуальные материалы и архитектура решения защищены авторским
                  правом (`/dev/batluk`). Коммерческое развёртывание под бренд заказчика
                  предусматривает полную передачу исходного кода, домена и подключение платёжных
                  шлюзов.
                </p>
              </section>
            </>
          )}

          {docId === 'cookies' && (
            <>
              <section className="space-y-2">
                <h3 className="font-display text-xs font-extrabold uppercase text-[#0B0B0B]">
                  Использование Cookie и локального хранилища браузера
                </h3>
                <p>
                  Мы не используем сторонние рекламные трекеры и системы скрытого профилирования.
                  Применяются только строго необходимые технические механизмы:
                </p>

                <div className="acrylic-light rounded-2xl overflow-hidden border border-black/10">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-black/[0.04] text-[#0B0B0B]/60 uppercase tracking-[0.08em]">
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold">Ключ</th>
                        <th className="px-3.5 py-2.5 font-semibold">Тип</th>
                        <th className="px-3.5 py-2.5 font-semibold">Назначение</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      <tr>
                        <td className="px-3.5 py-2.5 font-semibold text-[#0B0B0B]">
                          Сессия администратора
                        </td>
                        <td className="px-3.5 py-2.5">Технический Cookie</td>
                        <td className="px-3.5 py-2.5">
                          Поддержание авторизованной сессии в панели управления сайтом.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-semibold text-[#0B0B0B]">
                          Корзина покупок
                        </td>
                        <td className="px-3.5 py-2.5">Локальное хранилище</td>
                        <td className="px-3.5 py-2.5">
                          Сохранение выбранных позиций корзины и промокода между перезагрузками.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-semibold text-[#0B0B0B]">
                          Настройки уведомлений
                        </td>
                        <td className="px-3.5 py-2.5">Локальное хранилище</td>
                        <td className="px-3.5 py-2.5">
                          Запоминание вашего выбора по уведомлению о файлах Cookie.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p>
                  Вы можете изменить свой выбор в любой момент через ссылку «Настройки Cookie» в
                  подвале сайта или очистить хранилище в настройках браузера.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 px-5 sm:px-7 py-3.5 flex justify-end shrink-0">
          <OpticalButton
            variant="dark"
            onClick={onClose}
            rollingLabel="Понятно"
            className="h-10 px-6 text-xs font-semibold uppercase tracking-[0.08em]"
          />
        </div>
      </div>
    </div>
  );
}
