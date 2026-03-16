import { Button, Flex, ScrollArea, Tabs } from "@mantine/core";
import { useScrollIntoView } from "@mantine/hooks";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

type Tab = {
  label: string;
  value: string;
};

const SingleLineTabs: React.FC<{
  tabs: Tab[];
  currentTab: string;
  setCurrentTab: (newTab: string) => void;
}> = ({ setCurrentTab, currentTab, tabs }) => {
  const currentTabIndex = useMemo(
    () => tabs.findIndex((tab) => tab.value === currentTab),
    [currentTab, tabs],
  );

  const { targetRef, scrollableRef, scrollIntoView } = useScrollIntoView<
    HTMLButtonElement,
    HTMLDivElement
  >({ axis: "x", duration: 0 });

  const onChangeCurrentTab = useCallback(
    (newTab: string) => {
      setCurrentTab(newTab);
      scrollIntoView({ alignment: "center" });
    },
    [scrollIntoView, setCurrentTab],
  );

  return (
    <>
      <Flex align="center" justify="center">
        <Button
          variant="subtle"
          onClick={() => {
            onChangeCurrentTab(tabs[Math.max(0, currentTabIndex - 1)]!.value);
          }}
          disabled={currentTabIndex === 0}
        >
          <ChevronLeftIcon />
        </Button>
        <ScrollArea w={"100%"} scrollbars={false} viewportRef={scrollableRef}>
          <Tabs
            variant="default"
            value={currentTab}
            onChange={(newTab) => {
              if (newTab) {
                onChangeCurrentTab(newTab);
              }
            }}
          >
            <Tabs.List
              style={{
                flexWrap: "unset",
                minWidth: "max-content", // Ensures it grows with content
              }}
              grow
              justify="space-between"
            >
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  ref={currentTab === tab.value ? targetRef : undefined}
                >
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </ScrollArea>
        <Button
          variant="subtle"
          onClick={() => {
            onChangeCurrentTab(
              tabs[Math.min(tabs.length - 1, currentTabIndex + 1)]!.value,
            );
          }}
          disabled={currentTabIndex === tabs.length - 1}
        >
          <ChevronRightIcon />
        </Button>
      </Flex>
    </>
  );
};

export default SingleLineTabs;
